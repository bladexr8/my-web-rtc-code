/***
 * Excerpted from "Programming WebRTC",
 * published by The Pragmatic Bookshelf.
 * Copyrights apply to this code. It may not be used to create training material,
 * courses, books, articles, and the like. Contact us if you are in doubt.
 * We make no guarantees that this code is fit for any purpose.
 * Visit https://pragprog.com/titles/ksrtc for more book information.
 ***/
"use strict";

/**
 *  Global Variables: $self and $peer
 */
const $self = {
  rtcConfig: null,
  isPolite: false,
  isMakingOffer: false,
  isIgnoringOffer: false,
  isSettingRemoteAnswerPending: false,
  mediaConstraints: { audio: false, video: true },
};

const $peer = {
  connection: new RTCPeerConnection($self.rtcConfig),
};

/**
 *  Signaling-Channel Setup
 */

const namespace = prepareNamespace(window.location.hash, true);

// signalling channel
const sc = io.connect("/" + namespace, { autoConnect: false });

registerScCallbacks();

/**
 * Classes
 */
const VideoFX = class {
  constructor() {
    this.filters = ["grayscale", "sepia", "noir", "psychedelic", "none"];
  }
  cycleFilter() {
    const filter = this.filters.shift();
    this.filters.push(filter);
    return filter;
  }
};

/**
 * =========================================================================
 *  Begin Application-Specific Code
 * =========================================================================
 */

/**
 *  User-Interface Setup
 */

// update page with chat id
document.querySelector("#header h1").innerText =
  "Welcome to Room #" + namespace;

// handle join/leave call button
document
  .querySelector("#call-button")
  .addEventListener("click", handleCallButton);

// handle cycling through video filters
document.querySelector("#self").addEventListener("click", handleSelfVideo);

// handle submit button for chat
document.querySelector('#chat-form').addEventListener('submit', handleMessageForm);


/**
 *  User-Media Setup
 */
requestUserMedia($self.mediaConstraints);

$self.filters = new VideoFX();

$self.messageQueue = [];

/**
 *  User-Interface Functions and Callbacks
 */
function handleCallButton(event) {
  console.log("Call button clicked! Named callback function active!");

  const callButton = event.target;
  if (callButton.className === "join") {
    console.log("Joining the call...");
    callButton.className = "leave";
    callButton.innerText = "Leave Call";
    joinCall();
    console.log(`sc.active = ${sc.active}`);
  } else {
    console.log("Leaving the call...");
    callButton.className = "join";
    callButton.innerText = "Join Call";
    leaveCall();
    console.log(`sc.active = ${sc.active}`);
  }
}

function joinCall() {
  console.log("Opening Socket...");
  sc.open();
}

function leaveCall() {
  console.log("Closing Socket...");
  sc.close();
  resetPeer($peer);
}

function handleSelfVideo(event) {
  if ($peer.connection.connectionState !== "connected") return;
  const filter = `filter-${$self.filters.cycleFilter()}`;
  // set up data channel on peer
  const fdc = $peer.connection.createDataChannel(filter);
  fdc.onclose = function () {
    console.log(`Remote peer has closed the ${filter} data channel...`);
  };
  event.target.className = filter;
}

// handle chat form submission
function handleMessageForm(event) {
  console.log('Handling Message Input...');
  event.preventDefault();
  const input = document.querySelector('#chat-msg');
  const message = input.value;
  if (message === '') return;

  appendMessage('self', '#chat-log', message);
  // send message to peer chat or queue it
  sendOrQueueMessage($peer, message);
  input.value = '';
}

// append messages to chat
function appendMessage(sender, log_element, message) {
  console.log('Appending Message to Chat...');
  const log = document.querySelector(log_element);
  const li = document.createElement('li');
  li.className = sender;
  li.innerText = message;
  log.appendChild(li);
  // auto scroll
  if (log.scrollTo) {
    log.scrollTo({
      top: log.scrollHeight,
      behavior: 'smooth',
    });
  } else {
    log.scrollTop = log.scrollHeight;
  }
}

// Chat Message Queue Logic

// FIFO Queue for messages
function queueMessage(message, push = true) {
  if (push) {
    // queue at the end
    $self.messageQueue.push(message);
  } else {
    // queue at the start
    $self.messageQueue.unshift(message);
  }
  
}

// send messages if chat connected, else
// queue them
function sendOrQueueMessage(peer, message, push = true) {
  const chat_channel = peer.chatChannel;
  // check if peer is connected
  if (!chat_channel || chat_channel.readyState !== 'open') {
    queueMessage(message, push);
    return;
  }
  try {
    chat_channel.send(message);
  } catch(e) {
    console.error('Error sending message: ',e);
    queueMessage(message, push);
  }
}

/**
 *  User-Media and Data-Channel Functions
 */
async function requestUserMedia(media_constraints) {
  console.log("Requesting User Media...");
  $self.mediaStream = new MediaStream();
  $self.media = await navigator.mediaDevices.getUserMedia(media_constraints);
  $self.mediaStream.addTrack($self.media.getTracks()[0]);
  displayStream("#self", $self.mediaStream);
}

function displayStream(selector, stream) {
  document.querySelector(selector).srcObject = stream;
}

function addStreamingMedia(stream, peer) {
  console.log("Adding Streaming Media to Peer...");
  if (stream) {
    for (let track of stream.getTracks()) {
      peer.connection.addTrack(track, stream);
    }
  }
}

// open symmetric data channel (both users will open
// as part of joining the call)
function addChatChannel(peer) {
  peer.chatChannel = peer.connection.createDataChannel('text chat', {
    negotiated: true,
    id: 100
  });
  // receive message
  peer.chatChannel.onmessage = function(event) {
    appendMessage('peer', '#chat-log', event.data);
  };
  // close channel
  peer.chatChannel.onclose = function() {
    console.log('Chat Channel Closed...');
  };
  // open channel
  peer.chatChannel.onopen = function() {
    console.log('Chat channel opened...');
    while ($self.messageQueue.length > 0 && peer.chatChannel.readyState === 'open') {
      // send any queued messages
      let message = $self.messageQueue.shift();
      sendOrQueueMessage(peer, message, false);
    }
  };
}

/**
 *  Call Features & Reset Functions
 */
function establishCallFeatures(peer) {
  console.log("Establishing Call Features...");
  registerRtcCallbacks(peer);
  addChatChannel(peer);
  addStreamingMedia($self.mediaStream, peer);
}

function resetPeer(peer) {
  displayStream("#peer", null);
  peer.connection.close();
  peer.connection = new RTCPeerConnection($self.rtcConfig);
}

/**
 *  WebRTC Functions and Callbacks
 */
function registerRtcCallbacks(peer) {
  console.log("Registering RTC Callbacks...");
  peer.connection.onconnectionstatechange = handleRtcConnectionStateChange;
  peer.connection.ondatachannel = handleRtcDataChannel;
  peer.connection.onnegotiationneeded = handleRtcConnectionNegotiation;
  peer.connection.onicecandidate = handleRtcIceCandidate;
  peer.connection.ontrack = handleRtcPeerTrack;
}

function handleRtcPeerTrack({ track, streams: [stream] }) {
  // Handle peer media tracks
  console.log("Attempt to display media from peer...");
  displayStream("#peer", stream);
}

function handleRtcConnectionStateChange() {
  const connection_state = $peer.connection.connectionState;
  console.log(`The connection state is now ${connection_state}`);
  document.querySelector("body").className = connection_state;
}

function handleRtcDataChannel({ channel }) {
  const label = channel.label;
  console.log(`Data channel added for ${label}...`);
  if (label.startsWith("filter-")) {
    document.querySelector("#peer").className = label;
    // close the data channel
    channel.onopen = function () {
      channel.close();
    };
  }
}

/**
 * =========================================================================
 *  End Application-Specific Code
 * =========================================================================
 */

/**
 *  Reusable WebRTC Functions and Callbacks
 */
async function handleRtcConnectionNegotiation() {
  // Handle connection negotiation
  console.log("Handling RTC Connection Negotiation...");
  $self.isMakingOffer = true;
  console.log("Attempting to make an offer...");
  await $peer.connection.setLocalDescription();
  sc.emit("signal", { description: $peer.connection.localDescription });
  $self.isMakingOffer = false;
}

function handleRtcIceCandidate({ candidate }) {
  // Handle ICE candidates
  console.log("Attempting to handle an ICE candidate...");
  sc.emit("signal", { candidate: candidate });
}

/**
 *  Signaling-Channel Functions and Callbacks
 */
function registerScCallbacks() {
  console.log("Registering Sc callbacks...");
  sc.on("connect", handleScConnect);
  sc.on("connected peer", handleScConnectedPeer);
  sc.on("disconnected peer", handleScDisconnectedPeer);
  sc.on("signal", handleScSignal);
}

function handleScConnect() {
  console.log("Successfully connected to the signaling server...");
  establishCallFeatures($peer);
}

function handleScConnectedPeer() {
  console.log("Successfully Connected Peer...");
  // only initially connected party will receive this event
  $self.isPolite = true;
}

function handleScDisconnectedPeer() {
  resetPeer($peer);
  establishCallFeatures($peer);
}

async function handleScSignal({ description, candidate }) {
  console.log("Handling Sc Signal...");
  if (description) {
    console.log("Handling Local Description...");
    const ready_for_offer =
      !self.isMakingOffer &&
      ($peer.connection.signalingState == "stable" ||
        $self.isSettingRemoteAnswerPending);
    const offer_collision = description.type === "offer" && !ready_for_offer;
    $self.isIgnoringOffer = !$self.isPolite && offer_collision;
    if ($self.isIgnoringOffer) {
      return;
    }
    $self.isSettingRemoteAnswerPending = description.type == "answer";
    await $peer.connection.setRemoteDescription(description);
    $self.isSettingRemoteAnswerPending = false;
    if (description.type === "offer") {
      await $peer.connection.setLocalDescription();
      sc.emit("signal", { description: $peer.connection.localDescription });
    }
  } else if (candidate) {
    console.log("Handling Candidate...");
    try {
      await $peer.connection.addIceCandidate(candidate);
    } catch (e) {
      // Log error unless $self is ignoring offers
      // and candidate is not an empty string
      if ($self.isIgnoringOffer && candidate.candidate.length > 1) {
        console.error("Unable to add ICE candidate for peer: ", e);
      }
    }
  }
}

/**
 *  Utility Functions
 */
function prepareNamespace(hash, set_location) {
  let ns = hash.replace(/^#/, ""); // remove # from the hash
  if (/^[0-9]{7}$/.test(ns)) {
    console.log("Checked existing namespace", ns);
    return ns;
  }
  ns = Math.random().toString().substring(2, 9);
  console.log("Created new namespace", ns);
  if (set_location) window.location.hash = ns;
  return ns;
}
