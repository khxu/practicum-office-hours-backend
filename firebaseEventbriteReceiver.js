const functions = require('firebase-functions');

// The Firebase Admin SDK to access the Firebase Realtime Database. 
const admin = require('firebase-admin');

// This Firebase Cloud Function will have access to environmental variables re: the firebase database, since it'll be living on Google servers
let firebaseConfig = JSON.parse(process.env.FIREBASE_CONFIG);
/* {  databaseURL: 'https://databaseName.firebaseio.com',
       storageBucket: 'projectId.appspot.com',
       projectId: 'projectId' }
*/

admin.initializeApp(firebaseConfig);

// Listen to App Script payload that comes in
exports.recordEventbriteData = functions.https.onRequest((req, res) => {
  const eventbriteOrderPayload = req.body;
  // console.log('eventbriteOrderPayload', eventbriteOrderPayload);
  let timeslotClientRef;
  let claimedTimeslots;
  let timeslotPath;
  for (let event in eventbriteOrderPayload) {
    let eventSlots = {
      '1:00-1:40pm Timeslot': false,
      '2:00-2:40pm Timeslot': false,
      '3:00-3:40pm Timeslot': false,
      '4:00-4:40pm Timeslot': false
    }

    claimedTimeslots = JSON.parse(eventbriteOrderPayload[event]);
    claimedTimeslots.forEach(function(timeslot){
      switch (timeslot) {
        case "1:00-1:40pm Timeslot":
          timeslotPath = '1:00-2:00PM';
          eventSlots["1:00-1:40pm Timeslot"] = true;
          break;
        case "2:00-2:40pm Timeslot":
          timeslotPath = '2:00-3:00PM';
          eventSlots["2:00-2:40pm Timeslot"] = true;
          break;
        case "3:00-3:40pm Timeslot":
          timeslotPath = '3:00-4:00PM';
          eventSlots["3:00-3:40pm Timeslot"] = true;
          break;
        case "4:00-4:40pm Timeslot":
          timeslotPath = '4:00-5:00PM';
          eventSlots["4:00-4:40pm Timeslot"] = true;
          break;
      }
      timeslotClientRef = admin.database().ref('summer2018/events/' + event + '/timeslots/' + timeslotPath + '/client');
      timeslotClientRef.set(true);
    })

    for (var eventSlot in eventSlots) {
      if (eventSlots[eventSlot] === false) {
        switch (eventSlot) {
          case "1:00-1:40pm Timeslot":
            timeslotPath = '1:00-2:00PM';
            break;
          case "2:00-2:40pm Timeslot":
            timeslotPath = '2:00-3:00PM';
            break;
          case "3:00-3:40pm Timeslot":
            timeslotPath = '3:00-4:00PM';
            break;
          case "4:00-4:40pm Timeslot":
            timeslotPath = '4:00-5:00PM';
            break;
        }
        timeslotClientRef = admin.database().ref('summer2018/events/' + event + '/timeslots/' + timeslotPath + '/client');
        timeslotClientRef.set(false);
      }
    }
  }
  res.end();
})