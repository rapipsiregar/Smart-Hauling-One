from fastapi import APIRouter, HTTPException, status
from typing import List
from backend.models import TruckCreate, TruckResponse
from backend import database

router = APIRouter()

@router.post("/trucks", response_model=TruckResponse, status_code=status.HTTP_201_CREATED)
def create_truck(truck: TruckCreate):
    existing = database.get_truck_by_hull_id(truck.hull_id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Truck with Hull ID '{truck.hull_id}' already exists."
        )
    try:
        last_id = database.insert_truck(
            hull_id=truck.hull_id,
            contractor=truck.contractor,
            model=truck.model,
            status=truck.status
        )
        new_truck = database.get_truck_by_hull_id(truck.hull_id)
        if not new_truck:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve created truck."
            )
        return TruckResponse(**new_truck)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inserting truck: {str(e)}"
        )

@router.get("/trucks", response_model=List[TruckResponse])
def get_trucks():
    trucks = database.get_all_trucks()
    return [TruckResponse(**t) for t in trucks]

@router.get("/trucks/{hull_id}", response_model=TruckResponse)
def get_truck(hull_id: str):
    truck = database.get_truck_by_hull_id(hull_id)
    if not truck:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Truck with Hull ID '{hull_id}' not found."
        )
    return TruckResponse(**truck)

from fastapi import UploadFile, File
import csv
import io

import re

@router.post("/trucks/import-csv")
def import_trucks_csv(file: UploadFile = File(...)):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is not a CSV.")
    try:
        contents = file.file.read().decode("utf-8-sig")
        reader = list(csv.DictReader(io.StringIO(contents)))
        headers = {h.lower().strip().replace(" ", "_"): h for h in (reader[0].keys() if reader else [])}
        if not {"hull_id", "contractor", "model"}.issubset(headers.keys()):
            return {"status": "validation_failed", "errors": [{"row": 0, "field": "headers", "message": "CSV must contain headers: hull_id, contractor, model."}], "warnings": [], "imported": 0, "skipped": 0}
        
        errors, warnings, seen_in_csv = [], [], set()
        for idx, row in enumerate(reader, start=1):
            h_id = row.get(headers["hull_id"], "").strip()
            contractor = row.get(headers["contractor"], "").strip()
            model = row.get(headers["model"], "").strip()
            
            if not h_id: errors.append({"row": idx, "field": "hull_id", "message": "Hull ID is empty."})
            elif not re.match(r"^[a-zA-Z0-9\-_]+$", h_id): errors.append({"row": idx, "field": "hull_id", "message": f"Hull ID '{h_id}' is invalid (must be alphanumeric/dash/underscore)."})
            elif h_id in seen_in_csv: errors.append({"row": idx, "field": "hull_id", "message": f"Duplicate Hull ID '{h_id}' within CSV."})
            else: seen_in_csv.add(h_id)
            
            if not contractor: errors.append({"row": idx, "field": "contractor", "message": "Contractor is empty."})
            if not model: errors.append({"row": idx, "field": "model", "message": "Model is empty."})
            
            status_col = headers.get("status")
            if status_col:
                raw_st = row.get(status_col, "active").strip().lower()
                if raw_st not in ["active", "inactive"]: warnings.append({"row": idx, "field": "status", "message": f"Invalid status '{raw_st}' (defaulting to active)."})
            
            if h_id and database.get_truck_by_hull_id(h_id):
                warnings.append({"row": idx, "field": "hull_id", "message": f"Hull ID '{h_id}' already exists in registry (will be skipped)."})

        if errors:
            return {"status": "validation_failed", "errors": errors, "warnings": warnings, "imported": 0, "skipped": 0}

        imported, skipped = 0, 0
        for row in reader:
            h_id = row.get(headers["hull_id"], "").strip()
            contractor = row.get(headers["contractor"], "").strip()
            model = row.get(headers["model"], "").strip()
            raw_st = row.get(headers.get("status", ""), "active").strip().lower() if "status" in headers else "active"
            if raw_st not in ["active", "inactive"]: raw_st = "active"
            
            if database.get_truck_by_hull_id(h_id):
                skipped += 1
            else:
                database.insert_truck(hull_id=h_id, contractor=contractor, model=model, status=raw_st)
                imported += 1
                
        return {"status": "success", "errors": [], "warnings": warnings, "imported": imported, "skipped": skipped}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to parse CSV: {str(e)}"
        )

from pydantic import BaseModel

class UpdateStatusReq(BaseModel):
    status: str

@router.put("/trucks/{hull_id}/status")
def update_truck_status_route(hull_id: str, req: UpdateStatusReq):
    if req.status not in ["active", "inactive"]:
        raise HTTPException(status_code=400, detail="Invalid status. Must be active or inactive.")
    truck = database.get_truck_by_hull_id(hull_id)
    if not truck:
        raise HTTPException(status_code=404, detail="Truck not found.")
    try:
        database.update_truck_status(hull_id, req.status)
        return {"status": "success", "hull_id": hull_id, "new_status": req.status}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
