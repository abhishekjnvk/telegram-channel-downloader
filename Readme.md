# Telegram Channel Downloader

**Telegram Channel Downloader** is a Node.js application that allows users to download media files and messages in HTML and JSON formats from Telegram channels, groups, or users. This tool simplifies the process of archiving content from Telegram for offline viewing or storage.

## Sponsor the Project

<p>Support the project by buying me a coffee! Every contribution helps keep the project running.</p>
<a href="https://www.buymeacoffee.com/abhishekjnvk" target="_blank"><img src="https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png" alt="Buy Me A Coffee" style="height: 41px !important;width: 174px !important;box-shadow: 0px 3px 2px 0px rgba(190, 190, 190, 0.5) !important;-webkit-box-shadow: 0px 3px 2px 0px rgba(190, 190, 190, 0.5) !important;" ></a>

## Setup

To use the Telegram Channel Downloader, follow these steps:

1. **Create a Telegram App**: Go to [https://my.telegram.org/apps](https://my.telegram.org/apps) and create a new application.
2. **Get API Credentials**: After creating the app, copy the API ID and API Hash provided by Telegram.

### Configure `config.json`

3. In the root directory of the application, create a file named `config.json` and paste the following code:

    ```json
    {
        "apiId": "YOUR_API_ID",
        "apiHash": "YOUR_API_HASH",
        "sessionId": ""
    }
    ```

    Replace `YOUR_API_ID` and `YOUR_API_HASH` with the values obtained in step 2. Keep the `sessionId` blank for now; it will be updated automatically after logging in for the first time.

## Usage

Once the setup is complete, you can start using the Telegram Channel Downloader:

1. Install all dependencies using:  

    ```bash
    npm install
    ```

2. **Run the Script**: Open your terminal or command prompt and navigate to the directory where the Telegram Channel Downloader is located. Run the following command to start the script:

    ```bash
    npm start
    ```

3. **Login**: The script will prompt you to enter your phone number and the code sent to your phone or Telegram account. This authentication is required only the first time you run the script.

4. **Select Chat/Channel/Group**: After logging in, choose the target chat, channel, or group you want to scrape. Use the arrow keys to move and select the target chat.

5. **Wait for Download**: The script will start downloading all available media files and messages from the specified channel, group, or user. Depending on the size of the content, this process may take some time.

6. **Access Downloaded Files**: Once the download is complete, you can find the downloaded media files and messages in the `export/` directory within the Telegram Channel Downloader directory.

## CLI

Available Commands

| Script Name               | Description                                                   |
|---------------------------|---------------------------------------------------------------|
| `listen-channel`           | Listen to a channel and download media from incoming messages |
| `download-selected-message`| Download media from selected messages                         |
| `download-channel`         | Download all media from a channel                             |

***Using CLI Commands***

```bash
node cli [script-name] --options
```

example `node cli listen-channel --channelId=12345`

## Additional Notes

* **Session Handling**: The `sessionId` field in the `config.json` file will be automatically updated after logging in for the first time. This session ID is used for subsequent logins to avoid re-entering your credentials.
* **Media Types**: The Telegram Channel Downloader supports downloading various types of media files, including images, videos, audio files, documents, and other attachments shared within the specified channel, group, or user.

## Contributing

Contributions are welcome! If you have any suggestions, bug reports, or feature requests, please open an issue or submit a pull request.

Happy coding
