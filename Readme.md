# Telegram Channel Downloader
This is a simple script to download all the media files from a Telegram channel, group and user.

## Requirements
* Node.js
* npm

## Installation
* Install Using 
    ```bash
    git clone
    cd telegram-channel-downloader
    npm install
    ```

## Setup
* Create a Telegram app at https://my.telegram.org/apps
* Copy the API ID and API Hash
* Create a file named `config.json` in root directory and paste the following code:
    ```json
    {
        "apiId": 12345678,
        "apiHash": "",
        "sessionId": "",
    }
    ```
    Keep session id blank script will update it once you login for the first time.

## Usage
* Run the script using 
    ``` bash
    npm start
    ```
* Enter the phone number and the code sent to your phone or on telegram (This is for the first time you run script)
* Enter the channel/group/user name
* Wait for the script to download all the media files downloaded media files
* downloaded media and messages will be in ```export/``` directory 