//Latest index.js


//backup serverside code

const app = require("express")();
const http = require("http").createServer(app);
const bodyParser = require('body-parser');
app.use(bodyParser.json()); // Parse JSON bodies
app.use(bodyParser.urlencoded({ extended: true }));
const cors = require('cors');
const tryUser = require("./models/UserSchemas")
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
require('./dbConnect');
const mongoose = require("mongoose");
const useragent = require('useragent');

const { userInfo } = require("os");
const { disconnect } = require("process");
const { Console } = require("console");
app.use(cors({
  origin: '*',
}));
// const uri = 'mongodb+srv://StampaChat:goUGOq2fUPoJUvpD@cluster0.n98lqzj.mongodb.net/';
let SelectedUserOnline = ''
let isHistory2 = false
// async function connect() {
//   try {
//     await mongoose.connect(uri);
//     console.log("Connected to MongoDB");
//   } catch (error) {
//     console.error("error", error);
//   }
// }


// mongoose.connect(
//   uri
// )
// .then(()=>console.log('Mongo connected'))
// .catch(e=>console.log(e))

// connect();

const io = require("socket.io")(http, {
  cors: {
    origin: '*',

    methods: ['GET', 'POST'],

    allowedHeaders: ['Content-Type'],

    credentials: true,
  },
  maxHttpBufferSize: 10e6
});


const conversationSchema = new mongoose.Schema({
  conversationId: {
    type: String,
    required: true,
    unique: true,
  },
  messages: [
    {
      content: {
        type: String,
        required: true,
      },
      imageData: {
        type: Buffer, // Use Buffer data type for BSON
        required: false, // Make it optional if needed
      },
      from: {
        type: String,
        required: true,
      },
      to: {
        type: String,
        required: true,
      },
      timestamp: {
        type: Date,
        default: Date.now,
      },
    },
  ],
});

const Conversation = mongoose.model('Conversation', conversationSchema);



const UserSchema = mongoose.model("UserNew", {
  username: String,
  uuid: {
    type: String,
    default: uuidv4,
    unique: true
  },
  userID: String,
  ip: String,
  connectionTime: String,
  disconnectTime: String,
  disconnectTimeArray: [String],
  country_name: String,
  country_code2: String,
  timespend: String,
  unreadCount: String,
  isConversation: Boolean,
  AdminUsername: String,
  browser: String,
  operatingsystem: String,
  isOnline: {
    type: Boolean,
    default: true
  },
  VisitCounter: {
    type: Number,
    default: 0
  }
});


const DisconnectedUserSchema = mongoose.model("Disconnected-User", {
  socketIDs: {
    type: [String],
    required: true,
  },
});



const AdminSchema = mongoose.model("Admin", {
  username: String,
  uuid: {
    type: String,
    default: uuidv4,
    unique: true,
  },
  isActive: {
    type: Boolean,
    default: true
  },
  userID: [String], // Array of socket IDs
  ip: String,
  connectionTime: String,
});

//Schemas for members
// const Members = mongoose.model("ChatMember", {
//   members: {
//     type: Array
//   }
// });
app.post('/post', async (req, res) => {
  try {
    const { username, role } = req.body;
    const user = new UserSchema({ username, role });
    await user.save();
    res.status(201).json(user);
  } catch (error) {
    console.error(error); // Log the actual error message
    res.status(500).json({ error: "Failed to create user" });
  }
});


// io.use(async (socket, next) => {
//   const username = socket.handshake.auth.fetched_userName;
//   socket.username = username;
//   next();
// });

app.post('/session', (req, res) => {
  let data = {
    username: req.body.username,
    userID: uuidv4()
  }
  res.send(data);
});

io.use((socket, next) => {
  const username = socket.handshake.auth.username;
  const userID = socket.handshake.auth.userID;
  if (!username) {
    return next(new Error('Invalid username'));
  }
  // create new session
  socket.username = username;
  socket.id = userID;
  // console.log(" socket.id", socket.id)
  // console.log(" socket.username", socket.username)
  next();
});



const users = new Map(); // Map to store connected users with username as key

io.on("connection", async (socket) => {
  console.log("User connected:", socket.id);

  const ip = socket.handshake.headers['x-real-ip'] || socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;

  // Convert IPv6 loopback address to IPv4 format if necessary
  const clientip = ip.includes('::1') ? '127.0.0.1' : ip;
  if (clientip == '127.0.0.1') { formattedIP = '139.135.36.80' } else {
    formattedIP = clientip;
  }

  // async function setip(userName) {
  // try {
  // const ip = '139.135.36.80';
  const response = await fetch(`https://api.iplocation.net/?ip=${formattedIP}`);

  if (!response.ok) {
    throw new Error('Network response was not ok');
  }
  const results = await response.json();
  // console.log(results)

  const userAgent = useragent.parse(socket.handshake.headers['user-agent']);
  const operatingSystem = userAgent.os.toString();
  const browser = userAgent.toAgent();

  console.log("Operating System:", operatingSystem);
  console.log("Browser:", browser);



  // const editUser = await UserSchema.findOneAndUpdate({ userName }, { ip: ip, country_name: results.country_name, country_code2: results.country_code2 });// {...req.body}
  // console.log("result", results)
  // } catch (error) {
  //   console.error('Error saving users:', error);
  // }
  // }

  // Get the current connection time



  const connectionTime = moment().format('dddd D MMMM YYYY h:mm:ss A');
  const existingUser = await UserSchema.findOne({ userID: socket.id });
  if (existingUser) {
    existingUser.isOnline = true
    await existingUser.save();
  } else {
  }



  const Disconnected_user_to_client = [];

  socket.on("disconnect", async () => {
    console.log("User disconnected:", socket.id);
    for (const [username, user] of users) {
      if (user.userID === socket.id) {
        users.delete(username); // Remove the user from the Map
        break;
      }
    }
    io.emit("users", Array.from(users.values()));

    const disconnectTime = moment().format('dddd D MMMM YYYY h:mm:ss A');
    const existingUser = await UserSchema.findOne({ userID: socket.id });
    if (existingUser) {
      const connectionTime = moment(existingUser.connectionTime, 'dddd D MMMM YYYY h:mm:ss A');
      const duration = moment.duration(moment(disconnectTime, 'dddd D MMMM YYYY h:mm:ss A').diff(connectionTime));
      const timeSpentMinutes = duration.asMinutes();

      existingUser.timespend = timeSpentMinutes.toFixed(2);
      existingUser.disconnectTime = disconnectTime;
      existingUser.disconnectTimeArray.push(disconnectTime);
      existingUser.VisitCounter += 1;
      existingUser.isOnline = false;
      await existingUser.save();
    }

    const disconnectedUsersDB = await DisconnectedUserSchema.findOne({});
    const existingAdmin = await AdminSchema.findOne({ username: "admin" });
    let adminSocketIds = []
    if (existingAdmin) {
      adminSocketIds = existingAdmin.userID;
    }

    if (disconnectedUsersDB) {
      if (!disconnectedUsersDB.socketIDs.includes(socket.id)) {
        disconnectedUsersDB.socketIDs.push(socket.id);
        await disconnectedUsersDB.save();

        const disconnectedUsers = [];
        for (const socketId of disconnectedUsersDB.socketIDs) {
          const foundUser = await UserSchema.findOne({ userID: socketId });
          if (foundUser) {
            disconnectedUsers.push(foundUser);
          }
        }

        for (const socketId of adminSocketIds) {
          io.to(socketId).emit('disconnected-users', {
            UserstoClient: disconnectedUsers
          });
        }
      } else {
        const disconnectedUsers = [];
        for (const socketId of disconnectedUsersDB.socketIDs) {
          const foundUser = await UserSchema.findOne({ userID: socketId });
          if (foundUser) {
            disconnectedUsers.push(foundUser);
          }
        }

        for (const socketId of adminSocketIds) {
          io.to(socketId).emit('disconnected-users', {
            UserstoClient: disconnectedUsers
          });
        }
      }
    } else {
      const newDisconnectedUsers = new DisconnectedUserSchema({ socketIDs: [socket.id] });
      await newDisconnectedUsers.save();

      const disconnectedUsers = [];
      for (const socketId of newDisconnectedUsers.socketIDs) {
        const foundUser = await UserSchema.findOne({ userID: socketId });
        if (foundUser) {
          disconnectedUsers.push(foundUser);
        }
      }

      for (const socketId of adminSocketIds) {
        io.to(socketId).emit('disconnected-users', {
          UserstoClient: disconnectedUsers
        });
      }
    }
  });

  socket.on("admin_Status_from_client", async (adminStatus) => {
    const isStatus = adminStatus.adminStatus;

    const existingUser = await AdminSchema.findOne({ username: "admin" });
    try {

      if (existingUser) {
        existingUser.isActive = isStatus;
        await existingUser.save();
      } else {
        console.log("User not found");
      }
    } catch (error) {
      console.error('Error saving user:', error);
    }

    if (adminStatus.adminStatus == false) {
    console.log(adminStatus.adminStatus);
    users.delete(existingUser.username); // Remove admin user from the users array
    io.emit("users", Array.from(users.values()));
    io.emit("users", Array.from(users.values()));
  } else {  
    // User is active
    const user = {
      userID: existingUser.userID[0],
      username: existingUser.username,
      key: existingUser.userID[0],
      self: false,
      isOnline: true,
      ip: existingUser.formattedIP,
    };
    users.set(user.username, user);

    io.emit("users", Array.from(users.values()));
  }
  });

socket.on("endChat", async (userIDEnd) => {
  // console.log("userIDEnd",userIDEnd.userIDEnd)
  const to = userIDEnd.userIDEnd

  socket.to(to).emit("EndChat_from_server", {
    to
  });

});


socket.on("typing", async ({ to, username, from, messageContent }) => {
  const existingAdmin = await AdminSchema.findOne({ username: username });
  const socketIds = existingAdmin.userID;

  if (messageContent.trim().length > 0) {
    // User is typing, broadcast the 'userTyping' event
    socketIds.forEach((socketId) => {
      io.to(socketId).emit("userTyping", {
        messageContent: messageContent,
        from: from,
        SelectedUserOnline: SelectedUserOnline,
        to: to,
      });
    });
  } else {
    // User has stopped typing, broadcast the 'userStoppedTyping' event
    socketIds.forEach((socketId) => {
      io.to(socketId).emit("userStoppedTyping", {
        from: from,
        to: to,
      });
    });
  }
});


socket.on("typingSidebar", async ({ to, username, from, messageContent }) => {
  const existingAdmin = await AdminSchema.findOne({ username: username });
  const socketIds = existingAdmin.userID;

  if (messageContent.trim().length > 0) {
    // User is typing, broadcast the 'userTyping' event
    socketIds.forEach((socketId) => {
      io.to(socketId).emit("userTypingSidebar", {
        messageContent: messageContent,
        from: from,
        SelectedUserOnline: SelectedUserOnline,
        to: to,
      });
    });
  } else {
    // User has stopped typing, broadcast the 'userStoppedTyping' event
    socketIds.forEach((socketId) => {
      io.to(socketId).emit("userStoppedTypingSidebar", {
        from: from,
        to: to,
      });
    });
  }
});

socket.on("send message", async ({ recipientUserId, messageContent }) => {
  // console.log("recipientUserId",recipientUserId)
  // console.log("messageContent",messageContent)
  if (!users.has(recipientUserId)) {
    users.set(recipientUserId, { unreadCount: 1 });
  } else {
    const user = users.get(recipientUserId);
    if (SelectedUserOnline !== recipientUserId) {
      user.unreadCount += 1;
    }
  }




  io.emit("unread count update", {
    userId: recipientUserId,
    unreadCount: users.get(recipientUserId).unreadCount,
    SelectedUserOnline: SelectedUserOnline
  });

  try {
    const existingUser = await UserSchema.findOne({ userID: recipientUserId });
    if (existingUser) {
      existingUser.unreadCount = users.get(recipientUserId).unreadCount;
      await existingUser.save();
    }
  } catch (error) {
    console.error('Error saving user:', error);
  }

});

socket.on("messages read", async (userId) => {
  // console.log("messages read", userId)
  if (users.has(userId)) {
    const user = users.get(userId);
    if (user.unreadCount > 0) {
      user.unreadCount = 0;
      // console.log("I am in this condotion where 0")
    }


    io.emit("unread count update", {
      userId: userId,
      unreadCount: user.unreadCount,
      SelectedUserOnline: SelectedUserOnline
    });


  }

  try {
    // console.log("i am in try catch")
    const existingUser = await UserSchema.findOne({ userID: userId });
    if (existingUser) {
      // console.log("i am in if")
      existingUser.unreadCount = 0;
      await existingUser.save();
      // console.log("Save unread count")
    } else {
      // console.log("i am in else")
    }
  } catch (error) {
    console.error('Error saving user:', error);
  }
});

socket.on("selected User online", (selectedUser) => {
  // console.log("selectedUser", selectedUser);
  if (selectedUser == null || selectedUser == '') {
    SelectedUserOnline = '';
  } else {
    SelectedUserOnline = selectedUser;
  }

  socket.emit("selected_User_to_Client", {
    selectedUser: selectedUser
  });
});

socket.on("isHistory Chat", (isHistory) => {
  console.log("isHistory", isHistory);
  const isHistory2 = isHistory;

  socket.emit("isHistory_to_client", {
    isHistory2: isHistory2
  });
});


// console.log("isHistory222222",isHistory2)
socket.emit("isHistory_to_client", {
  isHistory2: isHistory2
}),
  // socket.on("send image", async ({ imageData }) => {
  //   console.log("imageData", imageData)
  // });

  // socket.on("private message", async ({ content, to }) => {
  //   // console.log("Content:", content, "To:", to);

  //   const conversationId = `admin_${to}`;
  //   let conversation = await Conversation.findOne({ conversationId });

  //   if (conversation) {
  //     conversation.messages.push({ content, from: socket.id, to });
  //   } else {
  //     conversation = new Conversation({
  //       conversationId,
  //       messages: [{ content, from: socket.id, to }],
  //     });
  //   }

  //   // await conversation.save();
  //   socket.to(to).emit("private message", {
  //     content,
  //     from: socket.id,
  //   });
  //   socket.to(to).emit("counterpopup", {
  //     content,
  //   });
  // });

  socket.on("private message admin", async ({ content, to, username, timestamp, from }) => {
    // console.log("selectedUser in private message", SelectedUserOnline)
    console.log("Content:", content, "To:", to, "username", username, "timestamp", timestamp, from);

    const conversationId = `admin_${from}`;
    let conversation = await Conversation.findOne({ conversationId });
    let userupdate = await UserSchema.findOne({ userID: from });
    // console.log("userupdate", userupdate)

    if (conversation) {
      conversation.messages.push({ content, from: socket.id, to });
    } else {
      conversation = new Conversation({
        conversationId,
        messages: [{ content, from: socket.id, to }],
      });
    }

    // await conversation.save();
    await conversation.save();
    const existingAdmin = await AdminSchema.findOne({ username: username });
    const socketIds = existingAdmin.userID;

    socketIds.forEach((socketId) => {
      io.to(socketId).emit('private message', {
        content,
        from: socket.id,
        timestamp,
      });
    });

    userupdate.isConversation = true;
    userupdate.AdminUsername = username;
    const saveduser = await userupdate.save();

    // console.log('Conversation status user updated:', saveduser);

    // socket.to(to).emit("private message", {
    //   content,
    //   from: socket.id,
    // });
  });


socket.on("save message", async ({ content, to, conversationID, imageData }) => {
  const conversationId = `admin_${conversationID}`;
  let conversation = await Conversation.findOne({ conversationId });
  if (imageData == null) {
    console.log("I am in if")
    if (conversation) {
      conversation.messages.push({
        content,
        from: socket.id,
        to,

      });
    } else {
      conversation = new Conversation({
        conversationId,
        messages: [
          {
            content,
            from: socket.id,
            to,

          },
        ],
      });
    }

    socket.to(to).emit("private message", {
      content,
      from: socket.id,
    });
    socket.to(to).emit("counterpopup", {
      content,
    });
  } else {
    console.log("I am in else")
    if (conversation) {
      conversation.messages.push({
        content,
        from: socket.id,
        to,
        imageData: Buffer.from(imageData, 'base64'), // Convert base64 to BSON
      });
    } else {
      conversation = new Conversation({
        conversationId,
        messages: [
          {
            content,
            from: socket.id,
            to,
            imageData: Buffer.from(imageData, 'base64'), // Convert base64 to BSON
          },
        ],
      });
    }

    socket.to(to).emit("private message", {
      content,
      from: socket.id,
      imageData: Buffer.from(imageData, 'base64'),
    });
    socket.to(to).emit("counterpopup", {
      content,
    });
  }

  await conversation.save();


});


// Get username from handshake authentication
const { username, userID } = socket.handshake.auth;
socket.username = username;
socket.id = userID



// Remove the user if it exists with a different socket ID
for (const [existingUsername, existingUser] of users) {
  if (existingUser.userID === socket.id && existingUsername !== socket.username) {
    users.delete(existingUsername);
    break;
  }
}

const newUser = {
  userID: socket.id,
  username: socket.username,
  key: socket.id,
  ip: formattedIP,
  country_name: results.country_name,
  country_code2: results.country_code2,
  isOnline: true,
};
// console.log("newUser",)
users.set(socket.username, newUser); // Add or update the user in the Map

// console.log("Before emitting User list:", Array.from(users.values()));

socket.emit("users", Array.from(users.values()));
socket.broadcast.emit("user connected", {
  userID: socket.id,
  username: socket.username,
  key: socket.id,
  self: false,
  ip: formattedIP,
  country_name: results.country_name,
  country_code2: results.country_code2,
  isOnline: true,
});

try {
  const existingUser = await UserSchema.findOne({ userID: socket.id });
  const existingAdmin = await AdminSchema.findOne({ username: "admin" });


  if (!existingUser) {
    if (!existingAdmin && socket.username === "admin") {
      const newUser = new AdminSchema({
        username: socket.username,
        uuid: uuidv4(),
        userID: [socket.id], // Store socket.id in an array
        ip: formattedIP,
        country_name: results.country_name,
        country_code2: results.country_code2,
        connectionTime: connectionTime
      });



      const savedUser = await newUser.save();
      // console.log('Admin saved:', savedUser);
    } else if (existingAdmin && socket.username === "admin") {
      if (existingAdmin.userID.includes(socket.id)) {
        // console.log("none")
      } else {
        existingAdmin.userID.push(socket.id);
        const savedAdmin = await existingAdmin.save();
        // console.log('Admin user updated:', savedAdmin);
      }

    } else if (socket.username !== "admin") {
      const newUser = new UserSchema({
        username: socket.username,
        uuid: uuidv4(),
        userID: socket.id,
        ip: formattedIP,
        country_name: results.country_name,
        country_code2: results.country_code2,
        connectionTime: connectionTime,
        isOnline: true,
        browser: browser,
        operatingsystem: operatingSystem,

      });
      const savedUser = await newUser.save();
      // console.log('User saved:', savedUser);
    } else {
      // console.log('None')
    }
  } else {
    // console.log('User already exists:', existingUser);
  }






  // if (!existingUser) {
  //   if (existingAdmin && socket.username === "admin") {
  //     existingAdmin.socketIDs = existingAdmin.socketIDs || []; // Initialize the socketIDs field if it doesn't exist

  //     existingAdmin.socketIDs.push(socket.id);
  //     const savedAdmin = await existingAdmin.save();
  //     console.log('Admin user updated:', savedAdmin);
  //   } else {
  //     const newUser = new UserSchema({
  //       username: socket.username,
  //       uuid: uuidv4(),
  //       userID: socket.id,
  //       ip: formattedIP,
  //       connectionTime: connectionTime
  //     });
  //     const savedUser = await newUser.save();
  //     console.log('User saved:', savedUser);
  //   }
  // } else {
  //   console.log('User already exists:', existingUser);
  // }
} catch (error) {
  console.error('Error saving users:', error);
}

  
});




app.get("/messages/:conversationId", async (req, res) => {

  try {
    const conversationId = req.params.conversationId;
    const message = await Conversation.findOne({ conversationId });
    res.json(message)
  }
  catch (error) {
    res.status(500).json(error)

  }
})
app.get("/users/disconnectedUsers", async (req, res) => {
  try {
    const disconnectedUsers = await DisconnectedUserSchema.find(); // Retrieve all documents from the DisconnectedUserModel

    const onlineUsers = [];

    for (const disconnectedUser of disconnectedUsers) {
      for (const socketId of disconnectedUser.socketIDs) {
        const user = await UserSchema.findOne({ userID: socketId });

        if (user && user.isConversation === true) {
          onlineUsers.push(user);
        }
      }
    }

    res.json(onlineUsers);
  } catch (error) {
    res.status(500).json(error);
  }
});


app.get("/usersCount", async (req, res) => {
  try {
    const users = await UserSchema.find({ unreadCount: { $gt: 0 } });
    res.json(users);
  } catch (error) {
    res.status(500).json(error);
  }
});


app.get("/users/:selectedUserOnline", async (req, res) => {
  try {
    const selectedUserOnline2 = req.params.selectedUserOnline;
    const users2 = await UserSchema.find({ userID: selectedUserOnline2 });

    res.json(users2);
  } catch (error) {
    res.status(500).json(error);
  }
});


// app.get('/api/checkAdminStatus', async (req, res) => {

//   // const { username } = req.body; 
//   const AdminExsist = await AdminSchema.find({ username: "admin" });

//   const isActive = AdminExsist.isActive


//   res.status(200).json({ isActive });
// });

app.get("/checkAdminStatus/:username", async (req, res) => {

  try {

    const username = req.params.username;
    const AdminExsist = await AdminSchema.find({ username: username });
    const isActive = AdminExsist[0].isActive

    res.json(isActive)
  }
  catch (error) {
    res.status(500).json(error)

  }
})

app.post("/users", async (req, res) => {
  try {
    const userInfo = req.body

    res.status(200).json(userInfo)
  }
  catch (error) {
    res.status(500).json(error)
  }
})

http.listen(4200, () => {
  console.log("Listening on port 4200");
});
