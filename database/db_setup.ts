import { MongoClient } from "mongodb";
import teamData from "../team_data/config.json";

const uri = "mongodb+srv://harshop12241:H%40rsh1to10@cluster0.mmhaq.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

async function setupDatabase() {
    try {
        await client.connect();
        const db = client.db("tournamentDB"); // Change database name as needed
        const collection = db.collection("team_points");

        // Drop existing collection if it exists
        const collections = await db.listCollections({ name: "team_points" }).toArray();
        if (collections.length > 0) {
            await collection.drop();
            console.log("Collection was deleted.");
        }

        // Insert new team data
        const teamPointsData = teamData.team_data.map((_, index) => ({
            team_id: index + 1,
            team_points: 0,
        }));

        await collection.insertMany(teamPointsData);
        console.log("Collection was created and data was inserted.");
    } catch (error) {
        console.error("Something happened. Check team data and config.json", error);
    } finally {
        await client.close();
    }
}

setupDatabase();
