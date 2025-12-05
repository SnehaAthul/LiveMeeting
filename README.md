##  Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Open the built-in DB viewer
npx prisma studio  

# Build for production
npm run build

# Start production server
npm start
```

Open [http://localhost:3000](http://localhost:3000) to see your application running.

## Setup docker:

created all the required configuration files inside the project folder: 

docker-compose.yml – Used to start the LiveKit Server, Redis, and Egress using Docker. 

livekit.yaml – Main LiveKit server configuration (API keys, ports, TURN/ICE settings, room settings). 

egress.yaml – Configuration for the recording (Egress) service. 

After installing Docker and Docker Compose, go to the project folder and start the LiveKit, Redis, and Egress servers using:

```bash
docker-compose up -d
```
