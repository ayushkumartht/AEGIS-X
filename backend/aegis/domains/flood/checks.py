"""Turns "variable with high value of information" into an action an officer can take."""

from __future__ import annotations

from aegis.domains.flood.types import KEY_BRIDGE_PREFIX, FloodScenario

ACTIONS = {
    "boat_availability_pct": "Call boat owners, NDRF and SDRF to confirm how many boats are really available",
    "boat_delay_h": "Confirm when boats can reach the staging points",
    "compliance_pct": "Ask ward members how many people will actually leave when ordered",
    "comms_degradation_pct": "Check with the telecom operators which areas will lose network",
    "peak_stage_m": "Wait for the next forecast run and check the upstream river gauge",
    "peak_time_h": "Check the upstream gauge trend to time the peak",
    "stage_bias_m": "Compare the forecast with the live gauge reading to correct the level",
    "local_rain_mm": "Check the latest IMD nowcast for the district",
}


def action_for(variable: str, scenario: FloodScenario) -> str:
    if variable.startswith(KEY_BRIDGE_PREFIX):
        bid = variable[len(KEY_BRIDGE_PREFIX) :]
        return f"Send a field team or drone to check {scenario.bridge_names.get(bid, bid)}"
    return ACTIONS.get(variable, f"Reduce the uncertainty in {variable}")
