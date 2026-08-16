"""Ritase counting: one ritase = one IN paired with one OUT.

A truck may enter and leave through the same gate, so pairing is done per hull
id across all gates, not per gate pair.

Two pairing modes, picked automatically from the data available:

``count``
    Used while crossing times are unknown. Ritase per hull is
    ``min(n_in, n_out)`` — order-free, and correct for the definition "one
    ritase = an IN and an OUT" without inventing a chronology. Ingest order is
    *not* chronological order, so it is never used as a stand-in.

``chronological``
    Used once every crossing of a hull has a real ``crossedAt``. Events are
    sorted by time and walked in sequence, which additionally yields the cycle
    duration of each ritase.

Leftover crossings (an IN with no OUT, or vice versa) are never discarded: they
are returned as ``unpaired`` so the UI can show them flagged.
"""

from __future__ import annotations

from datetime import datetime, timezone

# Which direction opens a cycle. None = accept either, pairing any two
# consecutive opposite-direction events. Set to "outbound" or "inbound" if the
# site defines the cycle start strictly.
CYCLE_OPENS_WITH: str | None = None

IN = "inbound"
OUT = "outbound"


def _parse(ts: str | None) -> datetime | None:
    """Parse a stored crossing time into a naive-UTC datetime.

    Every value here is sorted and subtracted against every other, so they must
    all be comparable. ``app/services/edge_ingest.py`` normalises edge
    submissions to the naive form before storing, but rows written before that
    still carry the contract's ``Z`` suffix, and Python refuses to compare an
    aware datetime with a naive one -- which took ``/api/ritase`` and
    ``/api/shift-report`` down with a 500 the moment one such row existed
    alongside batch rows. Stripping the offset here makes the mix sortable
    whatever wrote it.
    """
    if not ts:
        return None
    try:
        parsed = datetime.fromisoformat(str(ts).replace(" ", "T").replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed
    return parsed.astimezone(timezone.utc).replace(tzinfo=None)


def _pair_by_count(events: list[dict]) -> tuple[list[dict], list[dict]]:
    """``min(n_in, n_out)`` pairing for hulls without usable timestamps."""
    ins = [e for e in events if e.get("direction") == IN]
    outs = [e for e in events if e.get("direction") == OUT]
    n = min(len(ins), len(outs))
    pairs = [
        {"in": ins[i], "out": outs[i], "durationSeconds": None, "basis": "count"}
        for i in range(n)
    ]
    return pairs, ins[n:] + outs[n:]


def _pair_chronologically(events: list[dict]) -> tuple[list[dict], list[dict]]:
    """Walk events in time order, pairing opposite directions."""
    ordered = sorted(events, key=lambda e: _parse(e.get("crossedAt")))
    pairs: list[dict] = []
    unpaired: list[dict] = []
    open_event: dict | None = None

    for event in ordered:
        direction = event.get("direction")
        if open_event is None:
            if CYCLE_OPENS_WITH in (None, direction):
                open_event = event
            else:
                unpaired.append(event)
            continue

        if direction == open_event.get("direction"):
            # Two of the same direction in a row: the earlier one never found
            # its partner. Keep it flagged and let this one open the next cycle.
            unpaired.append(open_event)
            open_event = event
            continue

        # Opposite direction closes the cycle: OUT->IN and IN->OUT both count.
        start, end = open_event, event
        duration = (_parse(end["crossedAt"]) - _parse(start["crossedAt"])).total_seconds()
        pairs.append({
            "in": start if start.get("direction") == IN else end,
            "out": start if start.get("direction") == OUT else end,
            "durationSeconds": round(duration, 1),
            "basis": "chronological",
        })
        open_event = None

    if open_event is not None:
        unpaired.append(open_event)
    return pairs, unpaired


def pair_hull_events(events: list[dict]) -> tuple[list[dict], list[dict]]:
    """Pair one hull's crossings into ritase. Returns ``(pairs, unpaired)``."""
    directed = [e for e in events if e.get("direction") in (IN, OUT)]
    undirected = [e for e in events if e.get("direction") not in (IN, OUT)]

    if directed and all(_parse(e.get("crossedAt")) for e in directed):
        pairs, unpaired = _pair_chronologically(directed)
    else:
        pairs, unpaired = _pair_by_count(directed)

    return pairs, unpaired + undirected


def _reason(event: dict) -> str:
    direction = event.get("direction")
    if direction not in (IN, OUT):
        return "no-direction"
    return "missing-out" if direction == IN else "missing-in"


def _per_checkpoint(crossings: list[dict], by_hull: dict[str, list[dict]]) -> list[dict]:
    """Ritase and traffic broken down by checkpoint (CP 01..CP 04).

    A ritase is a *pair* of crossings and the two halves need not happen at the
    same checkpoint, so a pair is credited to the checkpoint of its INBOUND leg
    -- the moment the load entered. Splitting the credit in half, or counting the
    pair at both ends, would make the checkpoint totals stop summing to the site
    total, and the whole point of the breakdown is that the parts add up.
    """
    stats: dict[str, dict] = {}

    def bucket(name: str) -> dict:
        return stats.setdefault(name, {
            "checkpoint": name,
            "ritase": 0,
            "inbound": 0,
            "outbound": 0,
            "undirected": 0,
            "crossings": 0,
            "unidentified": 0,
        })

    for crossing in crossings:
        entry = bucket(crossing.get("checkpoint") or crossing.get("lane") or "-")
        entry["crossings"] += 1
        if not crossing.get("known"):
            entry["unidentified"] += 1
        direction = crossing.get("direction")
        if direction == IN:
            entry["inbound"] += 1
        elif direction == OUT:
            entry["outbound"] += 1
        else:
            entry["undirected"] += 1

    for events in by_hull.values():
        pairs, _ = pair_hull_events(events)
        for pair in pairs:
            leg = pair["in"]
            bucket(leg.get("checkpoint") or leg.get("lane") or "-")["ritase"] += 1

    return sorted(stats.values(), key=lambda c: c["checkpoint"])


def build_ritase(crossings: list[dict]) -> dict:
    """Aggregate reference-shaped crossings into ritase.

    Returns totals, per-hull and per-gate breakdowns, and the flagged unpaired
    crossings. Crossings whose hull id is unidentified cannot be paired (there
    is no truck to pair them to) and are reported as unpaired.
    """
    by_hull: dict[str, list[dict]] = {}
    unidentified: list[dict] = []
    for crossing in crossings:
        if not crossing.get("known"):
            unidentified.append(crossing)
            continue
        by_hull.setdefault(crossing["hullId"], []).append(crossing)

    per_hull: list[dict] = []
    unpaired: list[dict] = []
    total = 0
    chronological = 0

    for hull, events in sorted(by_hull.items()):
        pairs, leftovers = pair_hull_events(events)
        total += len(pairs)
        chronological += sum(1 for p in pairs if p["basis"] == "chronological")
        durations = [p["durationSeconds"] for p in pairs if p["durationSeconds"] is not None]
        per_hull.append({
            "hullId": hull,
            # A truck that crossed twice made a ritase whether or not the master
            # knows it. Counting it and flagging it is the honest pair: dropping
            # it under-reports real haulage, and hiding the flag would grow the
            # fleet by stealth.
            "registered": all(e.get("registered", True) for e in events),
            "ritase": len(pairs),
            "inCount": sum(1 for e in events if e.get("direction") == IN),
            "outCount": sum(1 for e in events if e.get("direction") == OUT),
            "unpaired": len(leftovers),
            "reads": sum(int(e.get("reads") or 0) for e in events),
            "bestConf": max((float(e.get("confidence") or 0) for e in events), default=0.0),
            "avgCycleSeconds": round(sum(durations) / len(durations), 1) if durations else None,
        })
        unpaired.extend(leftovers)

    per_hull.sort(key=lambda h: (-h["ritase"], h["hullId"]))

    per_gate: dict[str, dict] = {}
    for crossing in crossings:
        gate = per_gate.setdefault(
            crossing["lane"],
            {"gate": crossing["lane"], "inbound": 0, "outbound": 0, "undirected": 0},
        )
        direction = crossing.get("direction")
        key = direction if direction in (IN, OUT) else "undirected"
        gate[key if key == "undirected" else direction] += 1

    per_checkpoint = _per_checkpoint(crossings, by_hull)

    flagged = [
        {
            "id": e.get("id"),
            "hullId": e.get("hullId"),
            "lane": e.get("lane"),
            "direction": e.get("direction"),
            "crossedAt": e.get("crossedAt"),
            "reason": _reason(e),
        }
        for e in unpaired
    ] + [
        {
            "id": e.get("id"),
            "hullId": e.get("hullId"),
            "lane": e.get("lane"),
            "direction": e.get("direction"),
            "crossedAt": e.get("crossedAt"),
            "reason": "unidentified-hull",
        }
        for e in unidentified
    ]

    unregistered_ritase = sum(h["ritase"] for h in per_hull if not h["registered"])

    return {
        "totalRitase": total,
        # Broken out rather than buried: a shift whose haulage is partly by trucks
        # the master has never heard of is a registry problem to go and fix, and
        # the number is the prompt to fix it.
        "unregisteredRitase": unregistered_ritase,
        "unregisteredHulls": sorted(h["hullId"] for h in per_hull if not h["registered"]),
        "totalCrossings": len(crossings),
        "pairingBasis": "chronological" if chronological == total and total else "count",
        "hasCrossingTimes": any(c.get("crossedAt") for c in crossings),
        "unpairedCount": len(flagged),
        "perHull": per_hull,
        "perGate": sorted(per_gate.values(), key=lambda g: g["gate"]),
        # The breakdown the site actually plans and reports by. `perGate` is kept
        # alongside it rather than replaced: it groups by area, which the map
        # views still read.
        "perCheckpoint": per_checkpoint,
        "unpaired": flagged,
    }
