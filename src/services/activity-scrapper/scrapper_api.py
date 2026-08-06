import asyncio, pathlib, json
from codebuddy_agent_sdk import query, CodeBuddyAgentOptions, AssistantMessage, TextBlock

DAILY_LIST_AMT = 20

def find_project_root(marker: str = "count-me-in") -> pathlib.Path:
    current = pathlib.Path(__file__).resolve().parent
    for parent in [current, *current.parents]:
        if (parent / marker).is_dir():
            return parent
    raise FileNotFoundError(f"Could not find '{marker}' directory in any parent of {current}")

PROJECT_ROOT = find_project_root()

ACTIVITY_SCHEMA = {
    "type": "object",
    "properties": {
        "activities": {
            "type": "array",
            "items": {"type": "string"},
            "minItems": DAILY_LIST_AMT,
            "maxItems": DAILY_LIST_AMT,
        }
    },
    "required": ["activities"],
}

options = CodeBuddyAgentOptions(
    cwd=str(PROJECT_ROOT),
    setting_sources=["project"],
)



async def main():
    # Forming the prompt
    api_prompt = f"You are an AI assistant. Find me a list of {DAILY_LIST_AMT} activities for people aged 65 and above."

    # Assuming db is fetched and list is acquired
    db_list = ["NParks Horticulture walks", "Silver seniors", "ActiveSG chair pilates"]
    if db_list is not None and len(db_list) > 0:
        api_prompt += f" Do not include the list of places here as they have already been considered: {' ,'.join(db_list)}."

    # Fetching and await results
    proc = await asyncio.create_subprocess_exec(
        "codebuddy", "-p", api_prompt,
        "--output-format", "json",
        "--json-schema", json.dumps(ACTIVITY_SCHEMA),
        "-y",  # required for non-interactive mode; only safe in trusted envs
        cwd=str(PROJECT_ROOT),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate()

    # Failsafe checks
    if proc.returncode != 0:
        raise RuntimeError(f"codebuddy exited with {proc.returncode}: {stderr.decode().strip()}")
    try:
        response = json.loads(stdout)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"Failed to parse CLI output as JSON: {stdout.decode()!r}") from e

    structured = response.get("structured_output")
    if structured is None:
        raise RuntimeError(f"No structured_output in response: {response!r}")

    async for message in query(prompt=api_prompt, options=options):
        if isinstance(message, AssistantMessage):
            for block in message.content:
                if isinstance(block, TextBlock):
                    print(block.text)

asyncio.run(main())
