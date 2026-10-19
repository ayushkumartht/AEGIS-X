# Domain Models

## FloodModel
Simulates evacuation during a flash-flood event.
Success metric: `survivor_fraction` in [0,1] (higher is better).

## FireModel
Models wildfire spread and resource allocation.
Success metric: `area_saved_fraction` in [0,1].

## CrowdModel
Simulates crowd evacuation from a venue.
Success metric: `evacuation_rate` in [0,1].

All three implement the `DomainModel` interface in `backend/aegis/engine/interfaces.py`.
