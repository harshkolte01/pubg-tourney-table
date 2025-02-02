import cors from 'cors';
import express from 'express';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import { Server } from 'socket.io';
import http from 'http';

import teamData from './team_data/config.json';
import { teamPoints } from './interfaces';

dotenv.config(); // Load environment variables

const app = express();
const port = 3001;
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: 'http://localhost:3000',
        methods: ['GET', 'POST']
    },
    path: '/'
});

// MongoDB Connection
const uri = "mongodb+srv://harshop12241:H%40rsh1to10@cluster0.mmhaq.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
if (!uri) {
    throw new Error("MongoDB URI is missing. Set MONGO_URI in .env file.");
}
const client = new MongoClient(uri);
let db: any, teamPointsCollection: any;

async function connectDB() {
    await client.connect();
    db = client.db("tournamentDB");
    teamPointsCollection = db.collection("team_points");
    console.log("Connected to MongoDB!");
}
connectDB();

app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/team_logos', express.static(path.join(__dirname, 'team_data/team_logos')));

// Fetch team data
app.get('/api/team_data', async (req, res) => {
    try {
        const imagePromises = teamData.team_data.map(async (team, index) => {
            const imageData = await readFileAsync(team.logo);
            return {
                id: index + 1,
                name: team.name,
                initial: team.initial,
                logo_data: imageData.toString('base64'),
                team_color: teamData.table_data.background_color,
                header_color: teamData.table_data.header_color
            };
        });

        const imageData = await Promise.all(imagePromises);
        res.json(imageData);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error reading image data' });
    }
});

// Update team points
app.post('/api/update_points', async (req, res) => {
    const { data } = req.body;
    try {
        const team = await teamPointsCollection.findOne({ team_id: data.team_id });

        if (!team) {
            return res.status(404).json({ error: "Team not found" });
        }

        if (team.team_points === 0 && data.team_points < 0) {
            return res.status(400).json({ error: "Cannot subtract from zero" });
        }

        const newPoints = team.team_points + data.team_points;
        await teamPointsCollection.updateOne({ team_id: data.team_id }, { $set: { team_points: newPoints } });

        io.emit('points-update', data);
        res.json({ success: 'Successfully updated points!' });
    } catch (error) {
        console.error('Error updating points:', error);
        res.status(500).json({ error: 'Error updating points' });
    }
});

// Reset team points
app.post('/api/reset_points', async (req, res) => {
    const { data } = req.body;
    try {
        await teamPointsCollection.updateOne({ team_id: data.team_id }, { $set: { team_points: 0 } });

        io.emit('points-update', data);
        res.json({ success: 'Successfully reset points!' });
    } catch (error) {
        console.error('Error resetting points:', error);
        res.status(500).json({ error: 'Error resetting points' });
    }
});

// Get all team points
app.get('/api/team_points', async (req, res) => {
    try {
        const teams = await teamPointsCollection.find().toArray();
        res.json({ data: teams });
    } catch (error) {
        console.error('Error fetching team points:', error);
        res.status(500).json({ error: 'Error fetching team points' });
    }
});

// Handle team elimination
app.post('/api/team_eliminated', async (req, res) => {
    const { data } = req.body;
    try {
        const imagePromises = teamData.team_data.map(async (team) => {
            if (team.name === data.team_name) {
                const imageData = await readFileAsync(team.logo);
                return {
                    team_name: team.name,
                    team_logo_data: imageData.toString('base64')
                };
            }
        });

        const imageData = (await Promise.all(imagePromises)).filter(Boolean);
        res.json(imageData);
    } catch (error) {
        console.error('Error processing team elimination:', error);
        res.status(500).json({ error: 'Error processing team elimination' });
    }
});

// Emit elimination event
app.post('/api/team_eliminated_sc', (req, res) => {
    const { data } = req.body;
    try {
        io.emit('team-eliminate', data);
        res.json({ success: 'Successfully sent elimination event!' });
    } catch (error) {
        console.error('Error processing elimination event:', error);
        res.status(500).json({ error: 'Error processing elimination event' });
    }
});

// Handle player updates
app.post('/api/players_update', (req, res) => {
    const { data } = req.body;
    try {
        io.emit('players_update', data);
        res.json({ success: 'Successfully sent player data!' });
    } catch (error) {
        console.error('Error sending player data:', error);
        res.status(500).json({ error: 'Error sending player data!' });
    }
});

// WebSocket connection
io.on('connection', (socket) => {
    console.log('A client connected');
    socket.on('disconnect', () => {
        console.log('A client disconnected');
    });
});

// Utility function to read image files
function readFileAsync(filePath: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, (err, data) => {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
}

// Start servers
server.listen(3003);
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
