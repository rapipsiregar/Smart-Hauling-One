from backend import database

def calculate_class_distribution() -> dict:
    crossings = [c for c in database.get_all_crossings() if not c.get("is_duplicate")]
    distribution = {
        "Dump Truck": 0,
        "Light Vehicle": 0,
        "Excavator": 0
    }
    for c in crossings:
        v_class = c.get("vehicle_class", "Dump Truck")
        if v_class not in distribution:
            distribution[v_class] = 0
        distribution[v_class] += 1
    return {
        "status": "success",
        "distribution": distribution,
        "total_passages": sum(distribution.values())
    }
