# Orchestrator

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables in `.env`:
```env
# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key

# Spheron
SPHERON_PRIVATE_KEY=your_spheron_private_key

# Akash
AKASH_RPC_ENDPOINT=your_akash_rpc_endpoint
AKASH_MNEMONIC=your_akash_mnemonic

# Server
WEBHOOK_PORT=3080
```

3. Start the server:
```bash
npm start
```

## DOCUMENTATION

### Provider Plugins

Supported Providers
- Spheron
- Akash Network

### Services Plugins

Supported Services
- Backend Deployments
- Jupyter Notebook Instances

### Service Manager

### Routes

### Webhook


### Organization
- Provider plugins are at src/plugins/providers
- Services plugins are at src/plugins/services
- Service Manager at src/plugins/service-manager
- Routes are placed at src/routes
- Webhook logic is placed at src/webhook
- Constants including keys and other envs are at src/constants


### Route Controllers
- user related routes will need controller
- services related routes can directly instantiate services
- deployments related routes can use service-manager


### Templates Configuration:
1. Express.js Server with HTML rendered frontend at / page
- REPO_URL=https://github.com/Aquanodeio/templates.git
- BRANCH_NAME=js-calculator-server

2. Streamlit (Python) calculator example:
- REPO_URL=https://github.com/Aquanodeio/templates.git
- BRANCH_NAME=streamlit-example
- RUN_COMMANDS=pip3 install -r requirements.txt && streamlit run main.py
- MAKE SURE to set the PORT to 8501 during deployment, so the URL is http://localhost:8501