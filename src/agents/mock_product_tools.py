"""Temporary product-tool implementations for the voice demo.

The tool names and arguments are intentionally stable so teammates can replace
these bodies with their real recommendation and invitation implementations.
"""

import json

from agents import function_tool

MOCK_ACTIVITIES = (
    {
        "id": "library-craft",
        "name": "Quiet library craft session",
        "location": "Toa Payoh Public Library",
        "time": "Saturday afternoon",
        "distance": "1.2 km",
        "accessibility": "Seated and indoors",
        "cost": "Free",
    },
    {
        "id": "park-walk",
        "name": "Gentle garden walk",
        "location": "Bishan-Ang Mo Kio Park",
        "time": "Sunday morning",
        "distance": "2.4 km",
        "accessibility": "Flat paths with nearby seating",
        "cost": "Free",
    },
    {
        "id": "museum-tour",
        "name": "Small museum guided tour",
        "location": "Singapore Art Museum",
        "time": "Saturday morning",
        "distance": "5.8 km",
        "accessibility": "Indoors with lifts and seating",
        "cost": "$10",
    },
)


def recommend_activities(
    location: str,
    time_preference: str,
    activity_preference: str,
    mobility: str,
) -> str:
    """Return three mock activities matching the user's stated preferences.

    This is a stable placeholder for the teammates' future recommendation
    implementation. The mock keeps the arguments in the contract and includes
    the request summary so it can be swapped without changing the voice layer.
    """

    return json.dumps(
        {
            "request": {
                "location": location,
                "time_preference": time_preference,
                "activity_preference": activity_preference,
                "mobility": mobility,
            },
            "activities": list(MOCK_ACTIVITIES),
        }
    )


recommend_activities_tool = function_tool(
    recommend_activities,
    name_override="recommend_activities",
    description_override=(
        "Recommend three mock senior-friendly activities using the user's "
        "location, timing, activity style, and mobility needs."
    ),
)
