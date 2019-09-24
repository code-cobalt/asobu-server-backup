# Asobu Server

## Description
This is the back-end server for the [Asobu social meetup application](https://github.com/code-cobalt/asobu). It features a Node/Express server in TypeScript that manages all client connections, a GraphQL endpoint, and a single REST endpoint for uploads to Cloudinary. It utilizes a socket server to track users currently online on a 30-second heartbeat ping. The socket server is also used for sending triggers to clients to update parts of the application for live chats and other live features. If users aren't currently online, the push notification library will send a push notification to the ID they received from the Expo server upon login. Console logs are used and provide readable logs of server-related events.

## Usage
- Install the server dependencies via `yarn`
- Configure your .env file, which should include Cloudinary variables and a MongoDB DB_URL variable
- Start the server with `yarn backend`

