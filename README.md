# Count Me In
Count Me In is a voice-first companion agent that helps older adults find nearby activities and share their interest with trusted family or friends. Instead of making direct invitations, it creates low-pressure plans others can support by joining, reminding, arranging transport, or suggesting alternatives.

## Local voice demo

The first voice prototype runs locally from the terminal. It uses the computer's
default microphone and speakers, and it does not save transcripts or perform any
external actions.

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export OPENAI_API_KEY="sk-proj-your-key-here"
python -m src.demo.voice_cli
```

On macOS, grant your terminal microphone permission when prompted. Press
`Ctrl+C` to stop the demo.
