/* 
  NOTE: this is actually a .gs file, for Google Apps Script. It's not too different from vanilla JavaScript, 
  but there are helper methods that are specific to Google Services like UrlFetchApp, which allows for external REST calls.

  You can deploy this Google Apps Script file as a web app. After doing so, Google will assign a URL to this script.
  If a GET request is made to that URL, the doGet() function will be invoked.
  If a POST request is made to that URL, the doPost() function will be invoked.

  Eventbrite lets you set up a webhook that will fire a GET request to URLs of your choosing each time a new order comes in from
  one of your Eventbrite events (you can also have the webhook fire when an order cancels, an order is refunded, etc.).
  
  In our case, we fire our webhook each time an order is placed or gets refunded (which also captures instances where the
  attendee decides to cancel their appointment).
  
  When the webhook fires, the getEventbriteData() function gets invoked, and goes through the owned_events that are scheduled either
  on or after the present day. For each of these events, the getClaimedTimeslots() function fetches each timeslot (1-2pm, 2-3pm,
  3-4pm, or 4-5pm in our case) that currently has an attendee, and returns those. After iterating through each event, the
  data is sent to a Firebase Cloud Function to write to the Firebase Realtime Database.

  ***After further research, it's probably a needlessly convoluted path that we've currently set up--there should be a way to
  write directly to Firebase Realtime Database from Google Apps Script, rather than send a payload from Google Apps Script to
  a Firebase Cloud Function. One of these days I'll factor that...***
*/

var eventbriteToken = '{INSERT_EVENTBRITE_TOKEN_HERE}';
// Your Eventbrite token is located on your Eventbrite account under "Account Settings" >> "App Management"
var eventbriteParams = {
  headers: {
    Authorization: 'Bearer ' + eventbriteToken
  }
}
var today = new Date();

function doGet() {
  getEventbriteData();
}

function doPost() {
  getEventbriteData();
}

function getEventbriteData() {
  var response = UrlFetchApp.fetch('https://www.eventbriteapi.com/v3/users/{YOUR_USER_NUMBER_HERE}/owned_events/', eventbriteParams);
  var ownedEventsJSON = JSON.parse(response.getContentText());
  var eventIds = [];
  var continuationToken = ownedEventsJSON.pagination.continuation;
  var eventIdToDate = {};
  
//  Logger.log('page number: ' + JSON.stringify(ownedEventsJSON.pagination.page_number));
//  Logger.log('pagination: ' + JSON.stringify(ownedEventsJSON.pagination));
  var pageCount = ownedEventsJSON.pagination.page_count;
//  Logger.log('page count: ' + pageCount);
//  Logger.log('events: ' + JSON.stringify(ownedEventsJSON.events));
//  Logger.log('events length: ' + ownedEventsJSON.events.length);
  var eventDate;
  ownedEventsJSON.events.forEach(function(event){
    eventDate = new Date(event.start.local);
    if (eventDate >= today){
      eventIds.push(event.id);
      eventIdtoDate[event.id] = event.start.local;
    }
  })
  
//  Logger.log('eventIds before continuation: ' + JSON.stringify(eventIds));
//  Logger.log('eventIdtoDate before continuation: ' + JSON.stringify(eventIdToDate));
  
  var continuationIds;
  var continuationEventIdToDate;
  var continuationResponse;
  
  for(var i = 1; i < pageCount; i++) {
    continuationResponse = getContinuationEventIds(continuationToken)
    continuationIds = continuationResponse.eventIds;
    continuationEventIdToDate = continuationResponse.eventIdToDate;
    eventIds = eventIds.concat(continuationIds);
    for (var attrname in continuationEventIdToDate) { 
      eventIdToDate[attrname] = continuationEventIdToDate[attrname];
    }
    continuationToken = continuationResponse.continuation;
  }
  
//  Logger.log('eventIds after continuation: ' + JSON.stringify(eventIds));
//  Logger.log('eventIdtoDate after continuation: ' + JSON.stringify(eventIdToDate));
//  
//  Logger.log('eventIDs: ' + JSON.stringify(eventIds));
//  Logger.log('eventIDs length: ' + eventIds.length);
  var claimedTimeslots;
  var eventTimestamp;
  var eventDateToClaimedTimeslots = {};
  eventIds.forEach(function(eventId){
    claimedTimeslots = getClaimedTimeslots(eventId);
    eventTimestamp = eventIdToDate[eventId];
    eventDateToClaimedTimeslots[eventTimestamp] = JSON.stringify(claimedTimeslots);
  })
//  Logger.log('eventDateToClaimedTimeslots: ' + JSON.stringify(eventDateToClaimedTimeslots))

  sendToFirebase(eventDateToClaimedTimeslots);
}

function getContinuationEventIds(continuationToken) {
  // Logger.log('continuation token used: ' + continuationToken);
  var eventIds = [];
  var eventIdToDate = {};
  var response = UrlFetchApp.fetch('https://www.eventbriteapi.com/v3/users/{YOUR_USER_NUMBER_HERE}/owned_events/?continuation=' + continuationToken, eventbriteParams);
  var jsonResponse = JSON.parse(response.getContentText());
  jsonResponse.events.forEach(function(event){
    eventDate = new Date(event.start.local);
    if (eventDate >= today){
      eventIds.push(event.id);
      eventIdToDate[event.id] = event.start.local;
    }
  })
  return {eventIds: eventIds, eventIdToDate: eventIdToDate, continuation: jsonResponse.pagination.continuation};
}

function getClaimedTimeslots(eventId) {
  var response;
  var jsonResponse;
  var claimedTimeslots = [];
  
  response = UrlFetchApp.fetch('https://www.eventbriteapi.com/v3/events/' + eventId + '/attendees', eventbriteParams);
  jsonResponse = JSON.parse(response.getContentText());
  jsonResponse.attendees.forEach(function(attendee){
    // Only grab the attendees that have a status of 'placed'
    if (attendee.status === 'Attending') {
      claimedTimeslots.push(attendee.ticket_class_name);
    }
  })
  
//  Logger.log('claimedTimeslots: ' + JSON.stringify(claimedTimeslots));
  return claimedTimeslots;
}

function sendToFirebase(payloadToSend){
  var firebaseCloudFunctionUrl = '{YOUR_FIREBASE_CLOUD_FUNCTION_URL_HERE}';
  var options = {
    'method' : 'post',
    'payload' : payloadToSend
  };
  
  UrlFetchApp.fetch(firebaseCloudFunctionUrl, options);
//  Logger.log('payload sent to firebase!')
}