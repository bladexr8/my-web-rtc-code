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
  mediaConstraints: { audio: true, video: true },
  mediaStream: new MediaStream(),
  mediaTracks: {},
  features: {
    audio: false,
  },
};

const $peer = {
  connection: new RTCPeerConnection($self.rtcConfig),
  mediaStream: new MediaStream(),
  mediaTracks: {},
  features: {},
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
document
  .querySelector("#chat-form")
  .addEventListener("submit", handleMessageForm);

// set mic toggle state
document
  .querySelector("#toggle-mic")
  .setAttribute("aria-checked", $self.features.audio);

// set up handler for media buttons
document.querySelector("#footer").addEventListener("click", handleMediaButtons);

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
  console.log("Handling Message Input...");
  event.preventDefault();
  const input = document.querySelector("#chat-msg");
  const message = {};
  message.text = input.value;
  message.timestamp = Date.now();
  if (message === "") return;

  appendMessage("self", "#chat-log", message);
  // send message to peer chat or queue it
  sendOrQueueMessage($peer, message);
  input.value = "";
}

// append messages to chat
function appendMessage(sender, log_element, message) {
  console.log("Appending Message to Chat...");
  const log = document.querySelector(log_element);
  const li = document.createElement("li");
  li.className = sender;
  li.innerText = message.text;
  li.dataset.timestamp = message.timestamp;
  log.appendChild(li);
  // auto scroll
  if (log.scrollTo) {
    log.scrollTo({
      top: log.scrollHeight,
      behavior: "smooth",
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
  if (!chat_channel || chat_channel.readyState !== "open") {
    queueMessage(message, push);
    return;
  }
  try {
    chat_channel.send(JSON.stringify(message));
  } catch (e) {
    console.error("Error sending message: ", e);
    queueMessage(message, push);
  }
}

// Handle Media button toggles
function handleMediaButtons(event) {
  const target = event.target;
  if (target.tagName !== "BUTTON") return;
  switch (target.id) {
    case "toggle-mic":
      toggleMic(target);
      break;
    case "toggle-cam":
      toggleCam(target);
      break;
  }
}

function toggleMic(button) {
  console.log("Toggling Microphone...");
  const audio = $self.mediaTracks.audio;
  //console.log(`audio.enabled = ${audio.enabled}`);
  const enabled_state = (audio.enabled = !audio.enabled);
  $self.features.audio = enabled_state;
  button.setAttribute("aria-checked", enabled_state);

  // share features with $peer if connected
  shareFeatures('audio');
}

function toggleCam(button) {
  console.log("Toggling Video...");
  const video = $self.mediaTracks.video;
  const enabled_state = (video.enabled = !video.enabled);
  $self.features.video = enabled_state;
  button.setAttribute("aria-checked", enabled_state);

  // share features with $peer if connected
  shareFeatures('video');

  if (enabled_state) {
    $self.mediaStream.addTrack($self.mediaTracks.video);
  } else {
    $self.mediaStream.removeTrack($self.mediaTracks.video);
    displayStream("#self", $self.mediaStream);
  }
}

/**
 *  User-Media and Data-Channel Functions
 */
async function requestUserMedia(media_constraints) {
  console.log("Requesting User Media...");
  $self.media = await navigator.mediaDevices.getUserMedia(media_constraints);

  // Hold onto audio and video track references
  $self.mediaTracks.audio = $self.media.getAudioTracks()[0];
  $self.mediaTracks.video = $self.media.getVideoTracks()[0];

  // Mute the audio if `$self.features.audio` evaluates to `false`
  $self.mediaTracks.audio.enabled = !!$self.features.audio;

  // Add audio and video tracks to mediaStream
  $self.mediaStream.addTrack($self.mediaTracks.audio);
  $self.mediaStream.addTrack($self.mediaTracks.video);

  displayStream("#self", $self.mediaStream);
}

function displayStream(selector, stream) {
  document.querySelector(selector).srcObject = stream;
}

function addStreamingMedia(peer) {
  console.log("Adding Streaming Media to Peer...");
  const tracks_list = Object.keys($self.mediaTracks);
  for (let track of tracks_list) {
    peer.connection.addTrack($self.mediaTracks[track]);
  }
}

// open symmetric data channel (both users will open
// as part of joining the call)
function addChatChannel(peer) {
  peer.chatChannel = peer.connection.createDataChannel("text chat", {
    negotiated: true,
    id: 100,
  });

  // receive message
  peer.chatChannel.onmessage = function (event) {
    const message = JSON.parse(event.data);
    if (!message.id) {
      // Prepare a response and append an incoming message
      const response = {
        id: message.timestamp,
        timestamp: Date.now(),
      };
      sendOrQueueMessage(peer, response);
      appendMessage("peer", "#chat-log", message);
    } else {
      // Handle an incoming response
      handleResponse(message);
    }
  };

  // close channel
  peer.chatChannel.onclose = function () {
    console.log("Chat Channel Closed...");
  };

  // open channel
  peer.chatChannel.onopen = function () {
    console.log("Chat channel opened...");
    while (
      $self.messageQueue.length > 0 &&
      peer.chatChannel.readyState === "open"
    ) {
      // send any queued messages
      let message = $self.messageQueue.shift();
      sendOrQueueMessage(peer, message, false);
    }
  };
}


// add call features channel
function addFeaturesChannel(peer) {
  const featureFunctions = {
    audio: function() {
      console.log('Toggling Peer Mute Message...');
      const status = document.querySelector('#mic-status');
      // reveal "Remote peer is muted" message if muted (aria-hidden=false)
      // otherwise hide it (aria-hidden=true)
      status.setAttribute('aria-hidden', $peer.features.audio);
    }
  }
  console.log('Adding Features Channel...');
  peer.featuresChannel = peer.connection.createDataChannel('features', {
    negotiated: true,
    id: 110
  });

  peer.featuresChannel.onopen = function() {
    console.log('Features Channel Opened...');
    // send features information just as soon as the channel opens
    peer.featuresChannel.send(JSON.stringify($self.features));
  };

  peer.featuresChannel.onmessage = function(event) {
    console.log(`Features Channel Message Received: ${event.data}`);
    const features = JSON.parse(event.data);
    const features_list = Object.keys(features);
    for (let f of features_list) {
      console.log(`Processing Feature ${f}...`);
      // update the corresponding features field on $peer
      peer.features[f] = features[f];
      // if there's a corresponding function, run it
      if (typeof featureFunctions[f] === 'function') {
        featureFunctions[f]();
      }
    }
  };
}

function shareFeatures(...features) {
  const featuresToShare = {};

  // don't try to share features before joining the call or
  // before features channel is available
  if (!$peer.featuresChannel) return;

  for (let f of features) {
    featuresToShare[f] = $self.features[f];
  }

  try {
    $peer.featuresChannel.send(JSON.stringify(featuresToShare));
  } catch (e) {
    console.error('Error sending features: ', e);
    // No need to queue. Contents of $self.features will send
    // as soon as features channel opens
  }
}

function handleResponse(respone) {
  const sent_item = document.querySelector(
    `#chat-log *[data-timestamp="${response.id}"]`
  );
  const classes = ["received"];
  if (response.timestamp - response.id > 1000) {
    classes.push("delayed");
  }
  sent_item.classList.add(...classes);
}

/**
 *  Call Features & Reset Functions
 */
function establishCallFeatures(peer) {
  console.log("Establishing Call Features...");
  registerRtcCallbacks(peer);
  addFeaturesChannel(peer);
  addChatChannel(peer);
  addStreamingMedia(peer);
}

function resetPeer(peer) {
  displayStream("#peer", null);
  peer.connection.close();
  peer.connection = new RTCPeerConnection($self.rtcConfig);
  peer.mediaStream = new MediaStream();
  (peer.mediaTracks = {}), (peer.features = {});
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

function handleRtcPeerTrack({ track }) {
  // Handle peer media tracks
  console.log(`Handle incoming ${track.kind} track...`);
  $peer.mediaTracks[track.kind] = track;
  $peer.mediaStream.addTrack(track);
  displayStream("#peer", $peer.mediaStream);
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
