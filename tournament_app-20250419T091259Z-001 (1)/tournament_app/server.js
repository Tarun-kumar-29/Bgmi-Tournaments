const express = require('express');
const bodyParser = require('body-parser');
const admin = require('firebase-admin');
const cors = require('cors');

// Initialize Firebase Admin SDK
const serviceAccount = require('./../tournament-field-firebase-adminsdk-bh7xb-d4945ca020.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),  
  databaseURL: 'https://your-database-name.firebaseio.com'
});

const db = admin.firestore();
const app = express();

app.use(cors()); // Enable CORS for all routes
app.use(bodyParser.json());
// Middleware to log request headers and body
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  console.log('Headers:', req.headers);
  if (req.method === 'GET') {
    console.log('Query Params:', req.query);
  } else {
    console.log('Body:', req.body);
  }
  next();
});

const authenticate = async (req, res, next) => {
  // Authentication logic
  next();
};

// Middleware to authenticate and authorize requests
// Uncomment and implement authentication logic if required
// const authenticate = async (req, res, next) => {
//   const authHeader = req.headers.authorization;
//   if (!authHeader || !authHeader.startsWith('Bearer ')) {
//     return res.status(401).send('Unauthorized');
//   }

//   const idToken = authHeader.split('Bearer ')[1];
//   try {
//     const decodedToken = await admin.auth().verifyIdToken(idToken);
//     req.uid = decodedToken.uid;
//     next();
//   } catch (error) {
//     console.error('Error verifying Firebase ID token:', error);
//     res.status(401).send('Unauthorized');
//   }
// };

// Endpoint to add tournament details
app.post('/addTournamentdetails', authenticate, async (req, res) => {
  const tournamentData = {
    closingTime: admin.firestore.Timestamp.fromDate(new Date('2024-08-04T02:58:29+05:30')),
    description: 'Welcome to the Ultimate BGMI Showdown! ...',
    entriesLeft: 68,
    entryPrice: 20,
    imageUrl: 'https://wallpaperaccess.com/full/837399.jpg',
    map:'MIRAMAR',
    maxEntries: 100,
    mode: "FPP",
    prizePerKill: 20,
    rules: 'General Rules: ...',
    title: 'THE ULTIMATE KILLER',
    accesscode: '123456',
    tournamentEntry: [{
      userId: '4nxFKr7sKgWLC3wMaww2hGhgNIF3',
      date: admin.firestore.Timestamp.now(),
    }],
    tournamentType: 'SOLO',
    tournamentUrl : 'https://www.youtube.com/live/avR27gkR4bE?si=EFaw1c1psGmXqMgs',
    winPrize : 2500
  };

  try {
    const docRef = await db.collection('tournaments').add(tournamentData);
    console.log('Tournament added with ID: ', docRef.id);
    res.send('Tournament added with ID: ' + docRef.id);
  } catch (error) {
    console.error('Error adding tournament: ', error);
    res.status(500).send('Error adding tournament: ' + error.message);
  }
});

// Endpoint to create a wallet when a user registers
app.post('/createWallet', authenticate, async (req, res) => {
  try {
    const { uid } = req.body;
    if (!uid) {
      return res.status(400).send('Invalid request: UID is required');
    }

    const walletRef = db.collection('wallets').doc(uid);
    await walletRef.set({
      balance: 0,
      transactions: []
    });

    console.log('Wallet created successfully for user:', uid);
    res.send('Wallet created successfully');
  } catch (error) {
    console.error('Error creating wallet:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Endpoint to add money to wallet
app.post('/addMoney', authenticate, async (req, res) => {
  try {
    const { amount, uid } = req.body;
    if (typeof uid !== 'string' || typeof amount !== 'number') {
      return res.status(400).send('Invalid request: UID must be a string and amount must be a number');
    }

    const userWalletRef = db.collection('wallets').doc(uid);

    await db.runTransaction(async (transaction) => {
      const userWalletDoc = await transaction.get(userWalletRef);

      if (!userWalletDoc.exists) {
        throw new Error('Wallet does not exist');
      }

      const newBalance = userWalletDoc.data().balance + amount;
      transaction.update(userWalletRef, { balance: newBalance });

      const transactions = userWalletDoc.data().transactions || [];
      transactions.push({
        type: 'credit',
        amount: amount,
        date: admin.firestore.Timestamp.now(),
      });
      transaction.update(userWalletRef, { transactions: transactions });
    });

    res.send('Money added successfully');
    console.log('Money added successfully for user:', uid);
  } catch (error) {
    console.error('Error adding money:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Endpoint to enter a tournament
app.post('/tournament/enterTournament', authenticate, async (req, res) => {
  try {
    const { tid, uid, amount } = req.body;

    if (typeof tid !== 'string' || tid.trim() === '' || typeof uid !== 'string' || uid.trim() === '' || typeof amount !== 'number') {
      return res.status(400).send('Invalid request: UID and t_id must be non-empty strings and amount must be a number');
    }

    const userWalletRef = db.collection('wallets').doc(uid);
    const tournamentRef = db.collection('tournaments').doc(tid);

    await db.runTransaction(async (transaction) => {
      const userWalletDoc = await transaction.get(userWalletRef);
      const tournamentDoc = await transaction.get(tournamentRef);

      if (!userWalletDoc.exists) {
        throw new Error('Wallet does not exist');
      }
      if (!tournamentDoc.exists) {
        throw new Error('Tournament does not exist');
      }

      const currentBalance = userWalletDoc.data().balance;
      if (currentBalance < amount) {
        throw new Error('Insufficient balance');
      }

      const newBalance = currentBalance - amount;
      transaction.update(userWalletRef, { balance: newBalance });

      const tournamentEntry = tournamentDoc.data().tournamentEntry || [];
      const entriesLeft = tournamentDoc.data().entriesLeft;

      if (entriesLeft <= 0) {
        throw new Error('No entries left');
      }

      tournamentEntry.push({
        userId: uid,
        date: admin.firestore.Timestamp.now(),
      });

      transaction.update(tournamentRef, {
        tournamentEntry: tournamentEntry,
        entriesLeft: entriesLeft - 1
      });
    });

    res.send('Entered Tournament successfully');
    console.log('Tournament entered successfully for user and tournament:', uid, tid);
  } catch (error) {
    console.error('Error entering tournament:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Endpoint to withdraw money from wallet
app.post('/withdrawMoney', authenticate, async (req, res) => {
  try {
    const { uid, amount } = req.body;
    if (typeof uid !== 'string' || typeof amount !== 'number') {
      return res.status(400).send('Invalid request: UID must be a string and amount must be a number');
    }

    const userWalletRef = db.collection('wallets').doc(uid);
3
    await db.runTransaction(async (transaction) => {
      const userWalletDoc = await transaction.get(userWalletRef);

      if (!userWalletDoc.exists) {
        throw new Error('Wallet does not exist');
      }

      const currentBalance = userWalletDoc.data().balance;
      if (currentBalance < amount) {
        throw new Error('Insufficient balance');
      }

      const newBalance = currentBalance - amount;
      transaction.update(userWalletRef, { balance: newBalance });

      const transactions = userWalletDoc.data().transactions || [];
      transactions.push({
        type: 'debit',
        amount: amount,
        date: admin.firestore.Timestamp.now(),
      });
      transaction.update(userWalletRef, { transactions: transactions });
    });

    res.send('Money withdrawn successfully');
    console.log('Money withdrawn successfully for user:', uid);
  } catch (error) {
    console.error('Error withdrawing money:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/acessCode',authenticate,async(req, res) =>{


});

// Endpoint to get wallet balance
app.get('/wallet', authenticate, async (req, res) => {
  try {
    const { uid } = req.query;
    if (!uid) {
      return res.status(400).send('Invalid request: UID is required');
    }

    const walletRef = db.collection('wallets').doc(uid);
    const walletDoc = await walletRef.get();

    if (!walletDoc.exists) {
      return res.status(404).send('Wallet not found');
    }

    const balance = walletDoc.data().balance;
    res.json({ balance });
  } catch (error) {
    console.error('Error getting wallet balance:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Endpoint to get transaction history
app.get('/wallet/transactions', authenticate, async (req, res) => {
  try {
    const { uid } = req.query;
    if (!uid) {
      return res.status(400).send('Invalid request: UID is required');
    }

    const walletRef = db.collection('wallets').doc(uid);
    const walletDoc = await walletRef.get();

    if (!walletDoc.exists) {
      return res.status(404).send('Wallet not found');
    }

    const transactions = walletDoc.data().transactions || [];
    res.json({ transactions });
  } catch (error) {
    console.error('Error getting transaction history:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Endpoint to send game login code to tournament participants
app.post('/sendGameLoginCode', authenticate, async (req, res) => {
  try {
    const { tid, loginCode } = req.body;

    if (typeof tid !== 'string' || tid.trim() === '' || typeof loginCode !== 'string' || loginCode.trim() === '') {
      return res.status(400).send('Invalid request: tid and loginCode must be non-empty strings');
    }

    const tournamentRef = db.collection('tournaments').doc(tid);
    const tournamentDoc = await tournamentRef.get();

    if (!tournamentDoc.exists) {
      return res.status(404).send('Tournament not found');
    }

    const tournamentEntries = tournamentDoc.data().tournamentEntry || [];
    const tokens = tournamentEntries.map(entry => entry.userId); // Assuming userId is the FCM token

    const message = {
      notification: {
        title: 'Game Login Code',
        body: `Your game login code is: ${loginCode}`
      },
      tokens: tokens
    };

    const response = await admin.messaging().sendMulticast(message);
    console.log('Successfully sent message:', response);
    res.send('Game login code sent successfully');
  } catch (error) {
    console.error('Error sending game login code:', error);
    res.status(500).send('Internal Server Error');
  }
}); 

// Start the server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
