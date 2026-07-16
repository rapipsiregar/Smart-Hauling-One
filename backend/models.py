from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class TruckBase(BaseModel):
    hull_id: str = Field(..., description="Unique hull identifier of the OHT, e.g., DT-118")
    contractor: str = Field(..., description="Name of the transport contractor")
    model: str = Field(..., description="OHT model, e.g., CAT 777, CAT 773")
    status: str = Field("active", description="Operational status of the truck")

class TruckCreate(TruckBase):
    pass

class TruckResponse(TruckBase):
    id: int
    created_at: str

class CrossingBase(BaseModel):
    hull_id: str = Field(..., description="Matched hull ID of the truck")
    confidence: float = Field(..., description="OCR prediction confidence percentage (0.0 to 100.0)")
    timestamp: str = Field(..., description="UTC ISO Absolute timestamp of the crossing")
    lane: str = Field(..., description="Lane / Check Point location, e.g., North CK, North PPA")
    direction: str = Field(..., description="Direction of travel (inbound/outbound)")
    crop_image_path: Optional[str] = Field(None, description="Path to the cropped hull ID proof image")
    context_image_path: Optional[str] = Field(None, description="Path to the wide-angle context proof image")
    warning_status: str = Field("normal", description="OCR warning status indicator, e.g., normal or low-confidence")
    is_duplicate: int = Field(0, description="Flag indicating if the crossing is a duplicate")
    vehicle_class: Optional[str] = Field("Dump Truck", description="Determined class of the vehicle")

class CrossingCreate(CrossingBase):
    pass

class CrossingResponse(CrossingBase):
    id: int
    created_at: str
