# zAI Agent

zAI agent performs financial planning tasks. It uses Google's [A2A Protocol](https://google.github.io/A2A/#/) framework to collaborate with dependant agents.

To run it you'll need to:

1. Optionally update /etc/hosts
2. Configure .env file.
3. Run all dependant agents.
4. Start this agent.

## Optionally update /etc/hosts

If running inside docker, you can skip this step. If running natively you'll need to add the following entries into /etc/hosts file. Feel free to change C class subnets (127.0.3, 127.0.4, 127.0.5), if you have something already running on them.

```
127.0.3.1	zai-ma
127.0.4.1	dr-ma
127.0.4.2	hr-ma
127.0.4.3	finance-ma
127.0.4.4	equity-ma
127.0.4.5	planning-ma
127.0.5.1	analysis-ma
```

## Configure .env file
zAI Agent uses Anthropic's Claude LLM. To work with Anthropic you'll need to provide `ANTHROPIC_API_KEY`. Copy `.env.example` to `.env` and enter `ANTHROPIC_API_KEY` before starting zAI agent.

```bash
cp .env.example .env
# edit .env and update ANTHROPIC_API_KEY and save
```

## Run all dependant agents.
zAI agent needs the following agents to be running (required agents are specified in [src/agent/registered-agents.ts](src/agent/registered-agents.ts). They might have other dependencies, check their README.md files.

1. dr-ma for data retrieval and modification
2. analysis-ma for performing analysis

## Start this agent
```bash
# activate .env
set -a
source .env
set +a
# start the agent
STAGE=local npm run start:dev
```

### Testing the Agent
Once everything is up and running (including dependent agents) run zAI Agent's CLI interface:
```bash
npm run cli
```

