# my-web-rtc-code
Code from Pragmatic Programmers "Programming WebRTC" book

1. Use the following command to generate ssl certificates for dev:

``$ npm run ssl-keys --keydir="./ssl-certs" --numdays=1825 ``

2. Create a ``.env`` in the app root folder with the following contents:

```
LOCALHOST_SSL_KEY=./ssl-certs/localhost.key
LOCALHOST_SSL_CERT=./ssl-certs/localhost.crt
```


