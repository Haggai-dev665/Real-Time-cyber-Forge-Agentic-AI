# Appwrite Setup Guide for Cyberforge TODO 1

This guide explains how to set up Appwrite as the control plane for Cyberforge.

## Overview

Appwrite is the **single source of truth** for:
- Identity and authentication
- User and role management
- Device/agent registry
- Agent control commands
- Evidence metadata storage

⚠️ **NO service may re-implement auth or user state**

## Option 1: Appwrite Cloud (Recommended for Getting Started)

### 1. Create Appwrite Cloud Account

1. Go to [Appwrite Cloud](https://cloud.appwrite.io/)
2. Sign up for a free account
3. Create a new project named "Cyberforge"

### 2. Get Your Credentials

1. In the Appwrite Console, go to **Settings** → **View API Keys**
2. Create a new API key with **Server** scope
3. Note down:
   - **Endpoint**: `https://cloud.appwrite.io/v1`
   - **Project ID**: (from project settings)
   - **API Key**: (the key you just created)

### 3. Create Database and Collections

#### Create Database
1. Go to **Databases** → **Create database**
2. Name: `cyberforge`
3. Database ID: `cyberforge`

#### Create Collections

Create the following collections with these schemas:

##### Collection: `users` (ID: `users`)
This is typically auto-managed by Appwrite's authentication system.

##### Collection: `devices` (ID: `devices`)
| Attribute | Type | Size | Required | Array |
|-----------|------|------|----------|-------|
| userId | string | 255 | Yes | No |
| hostname | string | 255 | Yes | No |
| platform | string | 50 | Yes | No |
| type | string | 50 | Yes | No |
| status | string | 50 | Yes | No |
| metadata | string | 10000 | No | No |
| registeredAt | datetime | - | Yes | No |
| lastSeenAt | datetime | - | Yes | No |

##### Collection: `agents` (ID: `agents`)
| Attribute | Type | Size | Required | Array |
|-----------|------|------|----------|-------|
| deviceId | string | 255 | Yes | No |
| userId | string | 255 | Yes | No |
| agentType | string | 100 | Yes | No |
| version | string | 50 | Yes | No |
| capabilities | string | 1000 | No | No |
| state | string | 50 | Yes | No |
| status | string | 50 | Yes | No |
| registeredAt | datetime | - | Yes | No |
| lastHeartbeatAt | datetime | - | Yes | No |
| lastStateChange | datetime | - | No | No |
| errorCount | integer | - | No | No |
| metadata | string | 10000 | No | No |

##### Collection: `agent_tasks` (ID: `agent_tasks`)
| Attribute | Type | Size | Required | Array |
|-----------|------|------|----------|-------|
| agentId | string | 255 | Yes | No |
| userId | string | 255 | Yes | No |
| taskType | string | 100 | Yes | No |
| priority | string | 50 | Yes | No |
| targetUrl | string | 2000 | Yes | No |
| parameters | string | 10000 | No | No |
| status | string | 50 | Yes | No |
| createdAt | datetime | - | Yes | No |
| startedAt | datetime | - | No | No |
| completedAt | datetime | - | No | No |
| updatedAt | datetime | - | No | No |
| attempts | integer | - | No | No |
| result | string | 50000 | No | No |

##### Collection: `alerts` (ID: `alerts`)
| Attribute | Type | Size | Required | Array |
|-----------|------|------|----------|-------|
| userId | string | 255 | Yes | No |
| deviceId | string | 255 | Yes | No |
| agentId | string | 255 | Yes | No |
| taskId | string | 255 | Yes | No |
| evidenceId | string | 255 | Yes | No |
| mlOutputId | string | 255 | Yes | No |
| alertType | string | 100 | Yes | No |
| severity | string | 50 | Yes | No |
| title | string | 500 | Yes | No |
| description | string | 5000 | Yes | No |
| riskScore | integer | - | Yes | No |
| status | string | 50 | Yes | No |
| metadata | string | 10000 | No | No |
| createdAt | datetime | - | Yes | No |

##### Collection: `evidence_metadata` (ID: `evidence_metadata`)
| Attribute | Type | Size | Required | Array |
|-----------|------|------|----------|-------|
| userId | string | 255 | Yes | No |
| agentId | string | 255 | Yes | No |
| taskId | string | 255 | Yes | No |
| sourceType | string | 100 | Yes | No |
| targetUrl | string | 2000 | Yes | No |
| evidenceType | string | 100 | Yes | No |
| summary | string | 2000 | Yes | No |
| checksum | string | 64 | Yes | No |
| storageLocation | string | 500 | Yes | No |
| metadata | string | 10000 | No | No |
| collectedAt | datetime | - | Yes | No |

### 4. Configure Permissions

For each collection, set the following permissions:
- **Create**: Any authenticated user
- **Read**: Document owner (user)
- **Update**: Document owner (user)
- **Delete**: Document owner (user)

### 5. Create Roles

In **Auth** → **Teams**:
1. Create team roles:
   - `user` (default)
   - `admin`
   - `security_expert`

### 6. Update Environment Variables

Add to your `backend/.env`:

```env
# Appwrite Control Plane
APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
APPWRITE_PROJECT_ID=your-project-id-here
APPWRITE_API_KEY=your-api-key-here
APPWRITE_DATABASE_ID=cyberforge

# Collection IDs (if you used custom IDs)
APPWRITE_COLLECTION_USERS=users
APPWRITE_COLLECTION_DEVICES=devices
APPWRITE_COLLECTION_AGENTS=agents
APPWRITE_COLLECTION_AGENT_TASKS=agent_tasks
APPWRITE_COLLECTION_ALERTS=alerts
APPWRITE_COLLECTION_EVIDENCE_METADATA=evidence_metadata
```

## Option 2: Self-Hosted Appwrite (For Production)

### 1. Install Appwrite

```bash
# Using Docker Compose
docker run -it --rm \
    --volume /var/run/docker.sock:/var/run/docker.sock \
    --volume "$(pwd)"/appwrite:/usr/src/code/appwrite:rw \
    --entrypoint="install" \
    appwrite/appwrite:1.4.13
```

### 2. Access Appwrite

- Default URL: `http://localhost`
- Create your admin account
- Follow the same steps as Appwrite Cloud above

### 3. Update Environment

```env
APPWRITE_ENDPOINT=http://localhost/v1
```

## Verification

Test your Appwrite setup:

```bash
# From the backend directory
node -e "
const { initializeAppwriteServices } = require('./src/config/appwrite.config');
const services = initializeAppwriteServices();
console.log('✅ Appwrite connected successfully');
"
```

## Next Steps

1. Start the backend server: `npm run dev`
2. Start an agent: `POST /api/agent/start` with `{ "userId": "your-user-id" }`
3. Create a task: `POST /api/agent/task/create`
4. Monitor agent activity in Appwrite console

## Troubleshooting

### "Missing scope" errors
- Ensure your API key has all required scopes: `databases.read`, `databases.write`, `users.read`, `users.write`

### Connection timeout
- Check your `APPWRITE_ENDPOINT` is correct
- For self-hosted: ensure Appwrite container is running
- For cloud: check your internet connection

### Permission denied
- Verify collection permissions are set correctly
- Check that user has proper role assignments

## Security Notes

⚠️ **NEVER commit your API key to version control**
- Use `.env` file (already in `.gitignore`)
- Rotate API keys regularly
- Use different keys for development and production
