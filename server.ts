require('dotenv').config()
const express = require('express')
const app = express()
//Port config
const port = process.env.PORT || 3000
//GraphQL
const graphqlHTTP = require('express-graphql')
const { customFormatErrorFn } = require('apollo-errors')
import { createServer } from 'http'
import gql from 'graphql-tag'
import { print } from 'graphql'
//Body Parser
const bodyParser = require('body-parser')
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())
//Multer/Cloudinary for Uploads
const multer = require('multer')
const cloudinary = require('cloudinary')
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_KEY,
  api_secret: process.env.CLOUD_SECRET
})
const cloudinaryStorage = require('multer-storage-cloudinary')
const storage = cloudinaryStorage({
  cloudinary,
  folder: 'demo',
  allowedFormats: ['jpg', 'png'],
  transformation: [{ width: 500, height: 500, crop: 'limit' }]
})
const parser = multer({ storage })
//Mongoose for MongoDB queries
const mongoose = require('mongoose')
const schema = require('./server/schema.ts')
const root = require('./server/root.ts')
const { Seeder } = require('mongo-seeding')
//Path for static files
const path = require('path')
//WebSocket
const SocketServer = require('ws').Server
const axios = require('axios')

// setting useFindAndModify to false resolves MongoDB Node.js deprecation warnings from using certain Mongoose methods
// setting useCreateIndex true to allow unique constraint in user email
mongoose.connect(process.env.DB_URL, {
  useNewUrlParser: true,
  useFindAndModify: false,
  useCreateIndex: true
})

const db = mongoose.connection
db.once('open', () => console.log('Connected to DB'))

const config = {
  database: process.env.DB_URL,
  dropDatabase: true
}

// **DO NOT DELETE**
// NOTE: To avoid overages on our MongoDB/Cloudinary, please refrain from
// seeding, querying, and uploading too often!
// const seeder = new Seeder(config)
// const collections = seeder.readCollectionsFromPath(path.resolve('./data'))

// seeder
//   .import(collections)
//   .then(() => console.log('Successfully seeded database'))
//   .catch(err => console.log('Error seeding database', err))

app.use(
  '/graphql',
  graphqlHTTP({
    schema,
    customFormatErrorFn,
    rootValue: root
  })
)

app.post('/upload', parser.single('image'), (req, res) => {
  interface UploadedImage {
    url: string
    id: string
  }
  const image = <UploadedImage>{
    url: req.file.url,
    id: req.file.public_id
  }
  res.send(req.file.url)
})

interface Client {
  email: string
  socket: WebSocket
  token: string
  heartbeat: boolean
  failedPings: number
}

interface Clients {
  clientList: Object
}

interface ActiveClients {
  clientList: Object
}

class Client {
  constructor(email, socket, token) {
    this.email = email
    this.socket = socket
    this.token = token
    this.heartbeat = true
    this.failedPings = 0
  }
}

class Clients {
  constructor() {
    this.clientList = {}
    this.saveClient = this.saveClient.bind(this)
  }
  saveClient(client: Client) {
    this.clientList[client.email] = client
  }
  removeClient(email: string) {
    delete this.clientList[email]
  }
}

const clients = new Clients()

const httpServer = createServer(app)
const wss = new SocketServer({ server: httpServer })

async function getToken(email) {
  const query = gql`
    query User($userEmail: String!) {
      User(userEmail: $userEmail) {
        token
      }
    }
  `
  let tokenResult = await axios.post(
    'https://asobu-staging.herokuapp.com/graphql',
    {
      query: print(query),
      variables: {
        userEmail: email
      }
    }
  )

  const token = tokenResult.data.data.User.token
  return token
}

function sendPush(token, title, message) {
  let config = {
    headers: {
      host: 'exp.host',
      accept: 'application/json',
      'accept-encoding': 'gzip, deflate',
      'content-type': 'application/json'
    }
  }

  let data = {
    to: token,
    title: title,
    body: message
  }

  axios
    .post('https://exp.host/--/api/v2/push/send', data, config)
    .catch(err => {
      console.log('Axios push error:')
      console.log(err)
    })
}

wss.on('connection', ws => {
  console.log('New Client Connected')
  ws.on('message', async msg => {
    const message = msg.split(' ')
    //[0] - Login Code, [1] - User Email, [2] - User Token
    if (message[0] === 'l0') {
      if (clients.clientList[message[1]]) {
        let newClient = new Client(message[1], ws, message[2])
        Object.assign(clients.clientList[message[1]], newClient)
        console.log(`${clients.clientList[message[1]].email} has relogged.`)
      } else {
        let newClient = new Client(message[1], ws, message[2])
        clients.saveClient(newClient)
        console.log(`${message[1]} has logged in. Token is ${message[2]}.`)
        clients.clientList[message[1]].isAlive = true
        clients.clientList[message[1]].failedPings = 0
        const pulseCheck = setInterval(() => {
          if (!clients.clientList[message[1]].heartbeat) {
            clients.removeClient(newClient.email)
            clearInterval(pulseCheck)
            console.log(`${newClient.email} dropped.`)
          } else {
            clients.clientList[message[1]].failedPings++
            if (clients.clientList[message[1]].failedPings > 2)
              clients.clientList[message[1]].heartbeat = false
            clients.clientList[message[1]].socket.send('p0')
            console.log(
              `Heartbeat sent to ${clients.clientList[message[1]].email}. Failure rate ${newClient.failedPings}.`
            )
          }
        }, 15000)
      }
    }
    if (message[0] === 'l1') {
      clients.removeClient(message[1])
      console.log(`${message[1]} has logged out.`)
    }
    if (message[0] === 'p0') {
      if (clients.clientList[message[1]]) {
        clients.clientList[message[1]].failedPings = 0
        clients.clientList[message[1]].heartbeat = true
        console.log(`${message[1]} is alive.`)
      }
    }
    //[0] - Message Code, [1] - Target Email, [2] - Chat ID
    if (message[0] === 'm0') {
      console.log(`${message[1]} was sent an update for chat ${message[2]}.`)
      if (clients.clientList[message[1]]) {
        clients.clientList[message[1]].socket.send(`m0 ${message[2]}`)
        console.log(`${message[1]} was notified.`)
      } else {
        let token = await getToken(message[1])
        sendPush(token, 'New Message', 'You have a new chat message.')
        console.log(`Push notification sent to ${message[1]}.`)
      }
    }
    //[0] - Hangout Request Code, [1] - Sender Email, [2] - Target Email
    if (message[0] === 'h0') {
      console.log(`${message[1]} requested a hangout with ${message[2]}.`)
      if (clients.clientList[message[2]]) {
        clients.clientList[message[2]].socket.send(`h0 ${message[1]}`)
        console.log(`${message[2]} was notified.`)
      } else {
        let token = await getToken(message[2])
        sendPush(
          token,
          'New Hangout Request',
          'You have a received a new hangout request!'
        )
        console.log(`Push notification sent to ${message[2]}.`)
      }
    }
    //[0] - Hangout Accept Code, [1] - Accepting Email, [2] - Target Email, [3] - Accepting First Name
    if (message[0] === 'h1') {
      console.log(`${message[1]} accepted a hangout with ${message[2]}.`)
      if (clients.clientList[message[2]]) {
        clients.clientList[message[2]].socket.send(
          `h1 ${message[1]} ${message[3]}`
        )
        console.log(`${message[2]} was notified.`)
      } else {
        let token = await getToken(message[2])
        sendPush(
          token,
          'Hangout Request Accepted',
          'Your hangout request was accepted!'
        )
        console.log(`Push notification sent to ${message[2]}.`)
      }
    }
    //[0] - Start Hangout Request Code, [1] - Sender Email, [2] - Target Email, [3] - Sender First Name
    if (message[0] === 's0') {
      console.log(
        `${message[1]} has requested to start a hangout with ${message[2]}.`
      )
      if (clients.clientList[message[2]]) {
        clients.clientList[message[2]].socket.send(
          `s0 ${message[1]} ${message[3]}`
        )
        console.log(`${message[2]} was notified.`)
      } else {
        let token = await getToken(message[2])
        sendPush(
          token,
          'Start Your Hangout',
          'Your partner is ready to start your hangout!'
        )
        console.log(`Push notification sent to ${message[2]}.`)
      }
    }
    //[0] - Start Hangout Confirmed Code, [1] - Sender Email, [2] - Target Email, [3] - hangoutId
    if (message[0] === 's1') {
      console.log(`${message[1]} has confirmed a hangout with ${message[2]}.`)
      if (clients.clientList[message[2]]) {
        clients.clientList[message[2]].socket.send(
          `s1 ${message[1]} ${message[3]}`
        )
        console.log(`${message[2]} was notified.`)
      }
    }
    //[0] - Finish Hangout, [1] - Sender Email, [2] - Target Email, [3] - hangoutId
    if (message[0] === 'f1') {
      console.log(`${message[1]} has ended a hangout with ${message[2]}.`)
      if (clients.clientList[message[2]]) {
        clients.clientList[message[2]].socket.send(
          `f1 ${message[1]} ${message[3]}`
        )
        console.log(`${message[2]} was notified.`)
      }
    }
    //[0] - Block Code, [1] - Requesting Email, [2] - Target Email, [3] - Chat ID
    if (message[0] === 'b0') {
      console.log(`${message[1]} has blocked ${message[2]}.`)
      if (clients.clientList[message[2]])
        clients.clientList[message[2]].socket.send(`b0 ${message[1]}`)
      console.log(`${message[2]} was notified.`)
    }

    //[0] - Quiz Game Code, [1] - Origin Email, [2] - Origin First Name, [3] - Partner Email
    if (message[0] === 'q0') {
      console.log(
        `${message[1]} has requested to start a game with ${message[3]}`
      )
      if (clients.clientList[message[3]]) {
        clients.clientList[message[3]].socket.send(
          `q0 ${message[1]} ${message[2]}`
        )
        console.log(`${message[3]} was notified.`)
      }
    }
    //[0] - Quiz Accepted Code, [1] - Origin Email, [2] Partner Email
    if (message[0] === 'q1') {
      const randomNumber = Math.floor(Math.random() * 12)
      if (clients.clientList[message[1]] && clients.clientList[message[2]]) {
        clients.clientList[message[1]].socket.send(
          `q1 ${randomNumber} ${message[2]}`
        )
        console.log(`${message[1]} was sent a question.`)
        clients.clientList[message[2]].socket.send(
          `q1 ${randomNumber} ${message[1]}`
        )
        console.log(`${message[2]} was sent a question.`)
      } else {
        //Send error message if partner dropped
        if (clients.clientList[message[1]]) {
          clients.clientList[message[1]].socket.send('q9')
          console.log(`${message[1]} was sent an error code.`)
        }
      }
    }
    //[0] - Push Code, [1] - Target Email, [2] - Title, [3] - Message
    if (message[0] === 'push') {
      console.log(`Push requested with ${message}.`)
      if (clients.clientList[message[1]]) {
        const token = clients.clientList[message[1]].token
        const pushTitle = message[2].split(',').join(' ')
        const pushMessage = message[3].split(',').join(' ')
        sendPush(token, pushTitle, pushMessage)
        console.log(
          `Push notification sent to ${message[1]} titled ${pushTitle}.`
        )
      }
    }
  })

  ws.on('close', event => {})
})

httpServer.listen(port, () => console.log(`Listening on ${port}`))

export = { db }
