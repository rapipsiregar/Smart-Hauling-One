from typing import Dict, Any

def estimate_signal_metrics(latency: int, is_offline: bool) -> Dict[str, Any]:
    if is_offline:
        return {
            "uhf": {
                "snr_db": 0.0,
                "link_margin_db": 0.0,
                "packet_loss_pct": 100.0,
                "signal_strength_pct": 0.0
            },
            "lte": {
                "snr_db": 0.0,
                "link_margin_db": 0.0,
                "packet_loss_pct": 100.0,
                "signal_strength_pct": 0.0
            }
        }
        
    uhf_base_snr = 25.0
    uhf_latency_penalty = max(0.0, (latency - 50) * 0.05)
    uhf_snr = round(max(5.0, min(30.0, uhf_base_snr - uhf_latency_penalty)), 1)
    uhf_margin = round(uhf_snr - 10.0, 1)
    uhf_loss = round(max(0.0, min(100.0, (latency / 600.0) * 100.0)), 1)
    uhf_strength = round(max(0.0, min(100.0, (uhf_snr / 30.0) * 100.0)), 1)
    
    lte_base_snr = 28.0
    lte_latency_penalty = max(0.0, (latency - 30) * 0.04)
    lte_snr = round(max(3.0, min(35.0, lte_base_snr - lte_latency_penalty)), 1)
    lte_margin = round(lte_snr - 12.0, 1)
    lte_loss = round(max(0.0, min(100.0, (latency / 800.0) * 100.0)), 1)
    lte_strength = round(max(0.0, min(100.0, (lte_snr / 35.0) * 100.0)), 1)
    
    return {
        "uhf": {
            "snr_db": uhf_snr,
            "link_margin_db": uhf_margin,
            "packet_loss_pct": uhf_loss,
            "signal_strength_pct": uhf_strength
        },
        "lte": {
            "snr_db": lte_snr,
            "link_margin_db": lte_margin,
            "packet_loss_pct": lte_loss,
            "signal_strength_pct": lte_strength
        }
    }
