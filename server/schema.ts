const { buildSchema } = require('graphql')

const schema = buildSchema(`
    scalar DateTime 

    type Stats {
        funny: Int
        intellectual: Int
        fun: Int
        kind: Int
        therapeutic: Int
        interesting: Int
    }

    type UserLimited {
        first_name: String
        email: String
        profile_photo: String
        equipped_badges: [String]
        interests: [String]
        longitude: Float,
        latitude: Float,
        is_active: Boolean
    }

    type UserChat {
        chat_id: String
        participants: [UserLimited]
    }

    type UserEvent {
        event_id: String
        is_creator: Boolean
    }

    type Comment {
        id: String
        from: UserLimited
        content: String
        timestamp: DateTime
    }

    type Hangout {
        hangout_id: String
        participants: [UserLimited]
    }

    type User {
        id: String
        first_name: String
        last_name: String
        email: String
        phone_number: String
        profile_photo: String
        interests: [String]
        exp: Int
        lvl: Int
        stats: Stats
        chats: [UserChat]
        events: [UserEvent]
        sent_hangout_requests: [UserLimited]
        received_hangout_requests: [UserLimited]
        accepted_hangouts: [UserLimited]
        ongoing_hangouts: [Hangout]
        pending_reviews: [UserLimited]
        blocked_users: [String]
        blocked_by_users: [String]
        equipped_badges: [String]
        token: String
        longitude: Float,
        latitude: Float,
        is_active: Boolean
    }

    type Event {
        id: String
        name: String
        description: String
        cover_photo: String
        creator: UserLimited
        start: DateTime
        end: DateTime
        location: String
        limit: Int
        tags: [String]
        attendees: [UserLimited]
        comments: [Comment]
    }

    type Message {
        id: String
        chat_id: String
        from: UserLimited
        timestamp: DateTime
        content: String
    }

    type Subscription {
        messageAdded(somethingHere: String!): Message
    }

    type Chat {
        _id: String,
        messages: [Message]
    }

    input UserLimitedInput {
        first_name: String!
        email: String!
        profile_photo: String
        equipped_badges: [String]
    }

    input StatsInput {
        funny: Int
        intellectual: Int
        fun: Int
        kind: Int
        therapeutic: Int
        interesting: Int
    }

    input UserEventInput {
        event_id: String
        is_creator: Boolean
    }

    input NewEvent {
        name: String!
        description: String!
        cover_photo: String
        creator: UserLimitedInput!
        start: DateTime!
        end: DateTime!
        location: String!
        limit: Int
        tags: [String]
    }

    input UpdatedEvent {
        name: String
        description: String
        cover_photo: String
        start: DateTime
        end: DateTime
        location: String
        limit: Int
        tags: [String]
    }

    input NewUser {
        first_name: String!
        last_name: String!
        email: String!
        phone_number: String!
        password: String!
        pin: Int!
        interests: [String]
        exp: Int
        lvl: Int
        token: String
    }

    input UpdatedUser {
        first_name: String
        last_name: String
        email: String
        phone_number: String
        profile_photo: String
        interests: [String]
        equipped_badges: [String]
        token: String
        longitude: Float,
        latitude: Float,

        is_active: Boolean
    }

    input NewMessage {
        chat_id: String!
        from: UserLimitedInput!
        content: String!
    }

    input NewComment {
        from: UserLimitedInput!
        content: String!
    }

    type Query {
        Users: [User]
        User(userEmail: String!): User
        Login(userEmail: String!, userPassword: String!): User
        Events: [Event]
        Event(eventId: String!): Event
        Chat(chatId: String!): Chat
        Hangouts: [Hangout]
        Hangout(hangoutId: String!): Hangout
    }

    type Mutation {
        CreateEvent(newEvent: NewEvent!): Event
        UpdateEvent(eventId: String!, updatedEvent: UpdatedEvent!): Event
        DeleteEvent(eventId: String!): String
        CreateComment(eventId: String!, newComment: NewComment!): Comment
        DeleteComment(eventId: String!, commentId: String!): String
        CreateUser(newUser: NewUser!): User
        UpdateUser(userEmail: String!, updatedUser: UpdatedUser!): User
        ResetPassword(userEmail: String!, userPin: Int, newPassword: String): User
        DeleteUser(userEmail: String!, userPassword: String!): String
        CreateMessage(newMessage: NewMessage!): Message
        AttendEvent(eventId: String!, user: UserLimitedInput!): String
        UnattendEvent(eventId: String!, userEmail: String!): String
        ReviewUser(currentUserEmail: String!, reviewedUserEmail: String!, newStats: StatsInput!): Stats
        AddExp(userEmail: String!, points: Int): Int
        SendHangoutRequest(currentUserEmail: String!, toUserEmail: String!): String
        AcceptHangoutRequest(currentUserEmail: String!, fromUserEmail: String!): UserChat
        DeclineHangoutRequest(currentUserEmail: String!, fromUserEmail: String!): String
        StartHangout(participants: [UserLimitedInput]!): String
        FinishHangout(hangoutId: String!): String
        BlockUser(currentUserEmail: String!, blockedUserEmail: String, chatId: String!): String
        UnblockUser(currentUserEmail: String!, blockedUserEmail: String): String
    }
`)

export = schema
