/***
 * Excerpted from "Programming WebRTC",
 * published by The Pragmatic Bookshelf.
 * Copyrights apply to this code. It may not be used to create training material,
 * courses, books, articles, and the like. Contact us if you are in doubt.
 * We make no guarantees that this code is fit for any purpose.
 * Visit https://pragprog.com/titles/ksrtc for more book information.
***/
'use strict';

/**
 *  Global Variables: $self and $peer
 */



/**
 *  Signaling-Channel Setup
 */

const namespace = prepareNamespace(window.location.hash, true);

// signalling channel
const sc = io.connect('/' + namespace, { autoConnect: false});

registerScCallbacks();

/*sc.on('connect', function() {
  console.log('Successfully connected to the signalling channel!');
})

sc.on('disconnect', function() {
  console.log('Successfully disconnected from the signalling channel!');
})*/




/**
 * =========================================================================
 *  Begin Application-Specific Code
 * =========================================================================
 */


/**
 *  User-Interface Setup
 */

document.querySelector('#header h1')
  .innerText = 'Welcome to Room #' + namespace;

document.querySelector('#call-button')
  .addEventListener('click', handleCallButton);



/**
 *  User-Media Setup
 */





/**
 *  User-Interface Functions and Callbacks
 */
function handleCallButton(event) {
    console.log('Call button clicked! Named callback function active!');

    const callButton = event.target;
    if (callButton.className === 'join') {
      console.log('Joining the call...');
      callButton.className = 'leave';
      callButton.innerText = 'Leave Call';
      joinCall();
      console.log(`sc.active = ${sc.active}`);
    } else {
      console.log('Leaving the call...');
      callButton.className = 'join';
      callButton.innerText = 'Join Call';
      leaveCall();
      console.log(`sc.active = ${sc.active}`);
    }
}

function joinCall() {
  sc.open();
}

function leaveCall() {
  sc.close();
}


/**
 *  User-Media Functions
 */



/**
 *  Call Features & Reset Functions
 */




/**
 *  WebRTC Functions and Callbacks
 */





/**
 * =========================================================================
 *  End Application-Specific Code
 * =========================================================================
 */



/**
 *  Reusable WebRTC Functions and Callbacks
 */



/**
 *  Signaling-Channel Functions and Callbacks
 */
function registerScCallbacks() {
  sc.on('connect', handleScConnect);
  sc.on('connected peer', handleScConnectedPeer);
  sc.on('disconnected peer', handleScDisconnectedPeer);
  sc.on('signal', handleScSignal);
}

function handleScConnect() {
  console.log('Successfully connected to the signaling server');
}

function handleScConnectedPeer() {

}

function handleScDisconnectedPeer() {

}

function handleScSignal() {

}



/**
 *  Utility Functions
 */
function prepareNamespace(hash, set_location) {
  let ns = hash.replace(/^#/, ''); // remove # from the hash
  if (/^[0-9]{7}$/.test(ns)) {
    console.log('Checked existing namespace', ns);
    return ns;
  }
  ns = Math.random().toString().substring(2, 9);
  console.log('Created new namespace', ns);
  if (set_location) window.location.hash = ns;
  return ns;
}
