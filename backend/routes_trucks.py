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
