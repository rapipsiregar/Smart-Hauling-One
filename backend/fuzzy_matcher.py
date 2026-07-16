import rapidfuzz
from backend import database

def find_best_fleet_match(ocr_text: str, similarity_threshold: float = 75.0) -> str:
    if not ocr_text:
        return "DT-Unknown"
        
    target = ocr_text.strip().upper().replace(" ", "")
    if target.isdigit():
        target = f"DT-{target}"
        
    if not target.startswith("DT-"):
        if target.startswith("DT"):
            target = "DT-" + target[2:]
        elif target.startswith("D") and target[1:].isdigit():
            target = "DT-" + target[1:]
            
    trucks = database.get_all_trucks()
    if not trucks:
        return target
        
    best_match = None
    best_score = 0.0
    
    for truck in trucks:
        registered_id = truck["hull_id"]
        reg_standard = registered_id.strip().upper().replace(" ", "")
        
        score = rapidfuzz.fuzz.ratio(target, reg_standard)
        if score > best_score:
            best_score = score
            best_match = registered_id
            
    if best_score >= similarity_threshold:
        return best_match
        
    return target
