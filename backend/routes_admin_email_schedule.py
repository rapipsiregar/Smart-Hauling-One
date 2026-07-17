from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime
from backend import database
from backend.reports_logic import calculate_shift_summary
from backend.routes_contractor_efficiency import get_contractor_efficiency_grid
from backend.websocket_manager import manager

router = APIRouter()

class EmailScheduleReq(BaseModel):
    recipient: Optional[str] = "supervisor-shift-end@tunasinti.co.id"

def generate_compliance_email_html(compliance: dict, efficiency_grid: list, blocks: list) -> str:
    html = """
    <html>
    <head>
    <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; margin: 0; padding: 20px; background-color: #f8fafc; }
        .container { max-width: 800px; margin: 0 auto; background: #ffffff; padding: 24px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
        h2 { color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-top: 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; margin-bottom: 24px; }
        th, td { padding: 10px; border: 1px solid #cbd5e1; text-align: left; font-size: 0.9rem; }
        th { background-color: #f1f5f9; color: #1e293b; font-weight: bold; }
        .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; text-transform: uppercase; }
        .badge-success { background-color: #dcfce7; color: #15803d; }
        .badge-warning { background-color: #fef9c3; color: #854d0e; }
        .badge-danger { background-color: #fee2e2; color: #991b1b; }
        .text-mono { font-family: monospace; font-weight: bold; }
    </style>
    </head>
    <body>
    <div class="container">
        <h2>Shift-End Subcontractor Compliance Report</h2>
        <p>This automated summary packages subcontractor compliance and hourly efficiency comparisons for the current shift.</p>
        
        <h3>1. Subcontractor Compliance Overview</h3>
        <table>
            <thead>
                <tr>
                    <th>Contractor</th>
                    <th>Completed Ritase</th>
                    <th>Actual Capacity</th>
                    <th>Target Rate</th>
                    <th>Compliance %</th>
                    <th>Utilization %</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
    """
    for contractor, metrics in compliance.items():
        pct = metrics["compliance_pct"]
        status = "Optimal"
        badge_cls = "badge-success"
        if pct < 50:
            status = "Critical"
            badge_cls = "badge-danger"
        elif pct < 80:
            status = "Warning"
            badge_cls = "badge-warning"
            
        html += f"""
                <tr>
                    <td><strong>{contractor}</strong></td>
                    <td class="text-mono">{metrics['completed_cycles']}</td>
                    <td class="text-mono">{metrics['hourly_capacity']} rit/hr</td>
                    <td class="text-mono">{metrics['target_threshold']} rit/hr</td>
                    <td class="text-mono">{pct}%</td>
                    <td class="text-mono">{metrics['utilization_pct']}%</td>
                    <td><span class="badge {badge_cls}">{status}</span></td>
                </tr>
        """
        
    html += """
            </tbody>
        </table>
        
        <h3>2. Hourly Efficiency Comparison Heat Grid</h3>
        <table>
            <thead>
                <tr>
                    <th>Contractor</th>
    """
    for b in blocks:
        html += f"<th>{b}</th>"
    html += """
                </tr>
            </thead>
            <tbody>
    """
    for row in efficiency_grid:
        c_name = row["contractor"]
        html += f"<tr><td><strong>{c_name}</strong></td>"
        for b in blocks:
            b_data = row["blocks"].get(b, {"cycles": 0, "efficiency": 0.0})
            cycles = b_data["cycles"]
            eff = b_data["efficiency"]
            
            cell_style = ""
            if eff == 0:
                cell_style = "background-color: #f1f5f9; color: #64748b;"
            elif eff <= 0.5:
                cell_style = "background-color: #fee2e2; color: #991b1b;"
            elif eff <= 1.5:
                cell_style = "background-color: #fef9c3; color: #854d0e;"
            else:
                cell_style = "background-color: #dcfce7; color: #15803d;"
                
            html += f'<td style="{cell_style} font-size: 0.85rem;" class="text-mono">{cycles} rit ({eff} rit/hr)</td>'
        html += "</tr>"
        
    html += """
            </tbody>
        </table>
    </div>
    </body>
    </html>
    """
    return html

@router.post("/admin/reports/email-schedule")
async def send_compliance_email_schedule(req: EmailScheduleReq):
    try:
        summary = calculate_shift_summary()
        compliance = summary.get("compliance", {})
        
        eff_grid_response = get_contractor_efficiency_grid()
        efficiency_grid = eff_grid_response.get("grid", [])
        blocks = eff_grid_response.get("blocks", [])
        
        email_html = generate_compliance_email_html(compliance, efficiency_grid, blocks)
        
        # Log to dispatches database
        database.log_dispatch(
            alert_type="Compliance Shift Summary Email",
            message=email_html,
            recipient=req.recipient,
            channel="Email"
        )
        
        # Broadcast to WebSocket
        alert = {
            "alert_id": f"ALT-CS-{int(datetime.utcnow().timestamp())}",
            "type": "dispatch_alert",
            "trigger_source": "compliance_email",
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "severity": "info",
            "message": f"Compliance report shift summary email sent to {req.recipient}."
        }
        
        try:
            await manager.broadcast(alert)
        except Exception:
            pass
            
        return {
            "status": "success",
            "recipient": req.recipient,
            "compliance_records_sent": len(compliance),
            "efficiency_grid_contractors": len(efficiency_grid)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
