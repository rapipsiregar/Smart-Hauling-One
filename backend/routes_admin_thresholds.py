from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, field_validator
from typing import Dict
from backend import database

router = APIRouter()

class UpdateThresholdsReq(BaseModel):
    thresholds: Dict[str, float]

    @field_validator("thresholds")
    @classmethod
    def validate_thresholds(cls, val: Dict[str, float]) -> Dict[str, float]:
        for k, v in val.items():
            if k == "battery_low":
                if not (0.0 <= v <= 100.0):
                    raise ValueError("Battery threshold must be between 0 and 100")
            elif k == "latency_high":
                if v <= 0.0:
                    raise ValueError("Latency threshold must be greater than 0")
            elif k == "solar_low":
                if v < 0.0:
                    raise ValueError("Solar output threshold cannot be negative")
        return val

@router.put("/admin/alert-thresholds")
def update_alert_thresholds(req: UpdateThresholdsReq):
    try:
        allowed = {"battery_low", "solar_low", "latency_high"}
        filtered = {k: v for k, v in req.thresholds.items() if k in allowed}
        
        if not filtered:
            raise HTTPException(status_code=400, detail="No valid alert threshold fields specified.")
            
        database.set_thresholds(filtered)
        
        # Log to audit logs
        details_str = ", ".join(f"{k}={v}" for k, v in filtered.items())
        database.log_audit(
            action="threshold_change",
            details=f"Alert thresholds updated: {details_str}"
        )
        
        return {
            "status": "success",
            "message": "Alert thresholds updated successfully.",
            "thresholds": database.get_thresholds()
        }
    except ValueError as val_err:
        raise HTTPException(status_code=422, detail=str(val_err))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class UpdateOcrThresholdReq(BaseModel):
    ocr_confidence_min: float

    @field_validator("ocr_confidence_min")
    @classmethod
    def validate_ocr_confidence(cls, val: float) -> float:
        if not (0.0 <= val <= 100.0):
            raise ValueError("OCR confidence threshold must be between 0 and 100")
        return val

@router.put("/admin/ocr-thresholds")
def update_ocr_thresholds(req: UpdateOcrThresholdReq):
    try:
        database.set_thresholds({"ocr_confidence_min": req.ocr_confidence_min})
        
        database.log_audit(
            action="ocr_threshold_change",
            details=f"OCR confidence threshold updated to {req.ocr_confidence_min}%"
        )
        
        return {
            "status": "success",
            "message": "OCR confidence threshold updated successfully.",
            "ocr_confidence_min": req.ocr_confidence_min
        }
    except ValueError as val_err:
        raise HTTPException(status_code=422, detail=str(val_err))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
