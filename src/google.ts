import fs from "fs";
import path from "path";
import { Post } from "src";
import { authenticate } from "@google-cloud/local-auth";
import { google } from "googleapis";
import { OAuth2Client } from "googleapis-common";
import { JSONClient } from "google-auth-library/build/src/auth/googleauth";

const sheets = google.sheets("v4");
const TOKEN_PATH = path.join(process.cwd(), "token.json");
const CREDENTIALS_PATH = path.join(process.cwd(), "credentials.json");
const SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/spreadsheets",
];

let googleClient: OAuth2Client | JSONClient | null = null;

async function authorize() {
  if (googleClient == null) {
    try {
      // try to load credentials from storage
      googleClient = google.auth.fromJSON(JSON.parse(fs.readFileSync(TOKEN_PATH, { encoding: "utf-8" })));
    } catch {
      // if it fails, run the user through the auth process then save the token
      googleClient = await authenticate({
        scopes: SCOPES,
        keyfilePath: CREDENTIALS_PATH,
      });

      const keys = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, { encoding: "utf-8" }));
      const key = keys.installed || keys.web;
      const payload = JSON.stringify({
        type: "authorized_user",
        client_id: key.client_id,
        client_secret: key.client_secret,
        refresh_token: googleClient.credentials.refresh_token,
      });

      fs.writeFileSync(TOKEN_PATH, payload, { encoding: "utf8" });
    }
  }

  return googleClient;
}

export async function push(post: Post) {
  const auth = await authorize();

  const request = {
    auth,
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: "Testing!A2:I2",
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",

    resource: {
      // TODO: Add desired properties to the request body.
      values: [
        [
          post.section,
          post.article_title,
          post.published_on,
          post.byline_name,
          post.featured_visual_credit,
          post.excerpt,
          post.doc,
          post.visuals,
          post.article,
        ],
      ],
    },
  };

  (await sheets.spreadsheets.values.append(request)).data;
}
