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

document.querySelector("#header h1").innerText =
  "Welcome to Room #" + namespace;

document
  .querySelector("#call-button")
  .addEventListener("click", handleCallButton);

document.querySelector("#self").addEventListener("click", handleSelfVideo);

/**
 *  User-Media Setup
 */
requestUserMedia($self.mediaConstraints);

$self.filters = new VideoFX();

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
  if ($peer.connection.connectionState !== 'connected') return;
  const filter = `filter-${$self.filters.cycleFilter()}`;
  // set up data channel on peer
  const fdc = $peer.connection.createDataChannel(filter);
  fdc.onclose = function() {
    console.log(`Remote peer has closed the ${filter} data channel...`);
  };
  event.target.className = filter;
}

/**
 *  User-Media Functions
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

/**
 *  Call Features & Reset Functions
 */
function establishCallFeatures(peer) {
  console.log("Establishing Call Features...");
  registerRtcCallbacks(peer);
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
  document.querySelector('body').className = connection_state;
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
