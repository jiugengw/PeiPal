---
name: activity-scrapper
description: Generate a listing of activities that is fitting and suitable for people aged 65 and above
---

# Activities Scrapper

## Overview
Search online and return a list of 10 activities or events based in Singapore from now till 1 month later that is suitable for people aged 65 and above that has not been listed before.

## Trigger Patterns

Activate this skill when the prompt:
- Asks to scrape a list of activities for the target person who is an elderly, or aged 65 and above

## Workflow

### Step 1: Search and filter

1. Use web_search to find for 20 activities suitable for a person that is aged 65 and above.

**Filter requirements**
- Avoid high intensity physical activities, but can consider at least 1-2 endurance based activities.
- If a list of activities that has already been seen is provided, do not add it to the final
recommendations if the activity is already within that list.

2. If the activity in general is deemed suitable, keep the context of what the activity is about, the sequence of flow, location, signup deadline if any, date of event, slots available.

### Step 2: Scoring and ranking

For each activity, provide a score them based off universal suitability across the target audience specified above, and another score based off the estimated level of engagement for the audience. Take questions below as a guide.

1. What weightage of the audience above is physically capable of partaking in the activity?
2. How accessible is the location of the activity?
3. How limited is the slots available?
4. What is the estimated duration of the activity?
5. How engaging does the activity feel based off descriptions and past reviews for recurring activities?
6. How meaningful or purposeful does the activity feel?

After scoring, add both scores together, with suitability taking 60% and estimated level of engagement 40%. Return the top 10 results.


### Step 3: Summarize and Format
For each activity in the final list, return the activity/event name, location, date, start time, cost of participation and slots availability if any. In addition, give a summarized description of what the activity is about, and an appropriate title of a few words, connected by dashes which accurately depicts the activity. Include link to the event/activity, and an additional sign up link if any.


The title will serve as the id of the activity/event. For locations, if the activity has multiple locations, list out all available locations. For costs, if there's different pricings for different group of people, give the price for most majority, then indicate the pricing cost model under price remarks.

Below are the fields required and the format to write them out:
|Field|Format instruction|
|-|-|
|id|String in lowercase, connected by dashes|
|name|String|
|location|String|
|date|dd/mm/yyyy|
|start_time|h:mm am/pm, 12h clock|
|cost|Decimal number in terms of dollars. If free, indicate 0|
|price_remarks|String|
|slots_availability|String|
|info_link|String, url|
|signup_link|String, url|
