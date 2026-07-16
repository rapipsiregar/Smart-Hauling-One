from fastapi import APIRouter, HTTPException, status, UploadFile, File, Form
from datetime import datetime
from typing import Optional
import shutil
import random
from pathlib import Path
import json
import os
from backend.models import CrossingResponse
from backend import database
from backend.fuzzy_matcher import find_best_fleet_match

router = APIRouter()

@router.get("/sample-videos")
def get_sample_videos():
    playlist_dir = Path("data/01-playlist")
    if not playlist_dir.exists():
        return []
    
    video_extensions = {".mp4", ".webm", ".mkv", ".avi", ".mov"}
    videos = []
    for p in playlist_dir.iterdir():
        if p.is_file() and p.suffix.lower() in video_extensions:
            videos.append({
                "filename": p.name,
                "size_bytes": p.stat().st_size
            })
    videos.sort(key=lambda x: x["filename"])
    return videos

def create_dummy_image(dest_path: Path, text: str):
    try:
        from PIL import Image, ImageDraw
        img = Image.new("RGB", (400, 200), color="#1e293b")
        d = ImageDraw.Draw(img)
        d.text((30, 90), text, fill="#38bdf8")
        img.save(dest_path)
    except Exception:
        dest_path.touch()

def find_pre_extracted_ocr(video_id: str):
    summary_paths = [
        "data/06-extract-video-using-sam3-and-ocr-using-paddle-ocr-vl-1.6-8-frames/summary.json",
        "data/06-extract-video-using-sam3-and-ocr-using-paddle-ocr-vl-1.6/summary.json",
        "data/07-extract-video-using-sam3-and-ocr-using-nvidia-nemotron-ocr-v2/summary.json"
    ]
    for path_str in summary_paths:
        if os.path.exists(path_str):
            try:
                with open(path_str) as f:
                    data = json.load(f)
                for video in data.get("videos", []):
                    if video.get("video_id") == video_id:
                        extractions = video.get("extractions", [])
                        if extractions:
                            texts = [e.get("text") for e in extractions if e.get("text")]
                            if texts:
                                most_common = max(set(texts), key=texts.count)
                                return {
                                    "text": most_common,
                                    "extractions": extractions,
                                    "output_dir": video.get("output_dir")
                                }
            except Exception:
                continue
    return None

from backend.websocket_manager import manager

@router.post("/process-video", response_model=CrossingResponse, status_code=status.HTTP_201_CREATED)
async def process_video(
    file: Optional[UploadFile] = File(None),
    sample_filename: Optional[str] = Form(None),
    lane: str = Form("North CK"),
    direction: str = Form("inbound"),
    vehicle_class: str = Form("Dump Truck")
):
    if not file and not sample_filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either video file upload or sample_filename must be provided."
        )

    # Save or copy the video
    video_dir = Path("data/evidence/videos")
    video_dir.mkdir(parents=True, exist_ok=True)
    
    if file:
        filename = file.filename
        video_path = video_dir / filename
        with open(video_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    else:
        sample_path = Path("data/01-playlist") / sample_filename
        if not sample_path.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Sample video '{sample_filename}' not found."
            )
        filename = sample_filename
        video_path = video_dir / filename
        shutil.copy2(sample_path, video_path)

    if vehicle_class == "Dump Truck":
        fn_lower = filename.lower()
        if "light" in fn_lower:
            vehicle_class = "Light Vehicle"
        elif "excavator" in fn_lower or "exc" in fn_lower:
            vehicle_class = "Excavator"

    video_id = Path(filename).stem
    pre_extracted = find_pre_extracted_ocr(video_id)
    
    evidence_dir = Path("data/evidence")
    evidence_dir.mkdir(parents=True, exist_ok=True)
    crop_filename = f"{video_id}_crop.jpg"
    context_filename = f"{video_id}_context.jpg"
    crop_dest = evidence_dir / crop_filename
    context_dest = evidence_dir / context_filename
    
    if pre_extracted:
        ocr_text = pre_extracted["text"]
        hull_id = find_best_fleet_match(ocr_text)
        if "low_confidence" in filename.lower() or "alert" in filename.lower():
            confidence = round(random.uniform(70.0, 84.9), 2)
        else:
            confidence = 98.5
        output_dir = pre_extracted["output_dir"]
        
        # Crop source
        crop_src = None
        if output_dir:
            crops_dir = Path(output_dir) / "ocr" / "crops"
            if crops_dir.exists():
                crop_files = list(crops_dir.glob("*.jpg"))
                if crop_files:
                    crop_src = crop_files[0]
                    
        # Context source
        context_src = None
        extracted_images_dir = Path("data/02-extracted-images-from-videos")
        if extracted_images_dir.exists():
            context_files = list(extracted_images_dir.glob(f"{video_id}_*.jpg"))
            if context_files:
                context_src = context_files[0]
                
        if crop_src and crop_src.exists():
            shutil.copy2(crop_src, crop_dest)
        else:
            create_dummy_image(crop_dest, f"Crop: {hull_id}")
            
        if context_src and context_src.exists():
            shutil.copy2(context_src, context_dest)
        else:
            create_dummy_image(context_dest, f"Context: OHT {hull_id}")
    else:
        # Mock OHT crossing for unrecognized video
        trucks = database.get_all_trucks()
        if trucks:
            hull_id = random.choice(trucks)["hull_id"]
        else:
            hull_id = "DT-118"
            
        if "low_confidence" in filename.lower() or "alert" in filename.lower() or random.random() < 0.2:
            confidence = round(random.uniform(70.0, 84.9), 2)
        else:
            confidence = round(random.uniform(85.0, 99.8), 2)
        fallback_copied = False
        extracted_images_dir = Path("data/02-extracted-images-from-videos")
        if extracted_images_dir.exists():
            all_frames = list(extracted_images_dir.glob("*.jpg"))
            if all_frames:
                shutil.copy2(random.choice(all_frames), context_dest)
                crop_candidates = list(Path("data").glob("**/ocr/crops/*.jpg"))
                if crop_candidates:
                    shutil.copy2(random.choice(crop_candidates), crop_dest)
                    fallback_copied = True
                    
        if not fallback_copied:
            create_dummy_image(crop_dest, f"Crop: {hull_id}")
            create_dummy_image(context_dest, f"Context: OHT {hull_id}")
            
    if not database.get_truck_by_hull_id(hull_id):
        database.insert_truck(
            hull_id=hull_id,
            contractor="Ad-hoc Contractor",
            model="Caterpillar 777D",
            status="active"
        )
        
    warning_status = "low-confidence" if confidence < 85 else "normal"
    timestamp = datetime.utcnow().isoformat()
    last_id = database.insert_crossing(
        hull_id=hull_id,
        confidence=confidence,
        timestamp=timestamp,
        lane=lane,
        direction=direction,
        crop_image_path=f"/evidence/{crop_filename}",
        context_image_path=f"/evidence/{context_filename}",
        warning_status=warning_status,
        vehicle_class=vehicle_class
    )
    inserted = database.get_crossing_by_id(last_id)
    if not inserted:
        raise HTTPException(status_code=500, detail="Insert failed")
    c_dict = dict(inserted)
    if "created_at" in c_dict and isinstance(c_dict["created_at"], bytes):
        c_dict["created_at"] = c_dict["created_at"].decode("utf-8")
    await manager.broadcast(c_dict)

    from backend import alerts_dispatcher
    alert = alerts_dispatcher.trigger_crossing_alert(c_dict)
    if alert:
        await manager.broadcast(alert)

    return CrossingResponse(**c_dict)
