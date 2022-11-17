import axios from "axios";
import djs from "discord.js";
import dateFormat from "dateformat";
import HTMLParser from "node-html-parser";
import { push } from "./google";
require("dotenv").config();

export interface Post {
  section: string; // discord
  article_title: string; // discord
  published_on: string; // scraping medium
  byline_name: string; // scraping medium
  featured_visual_credit?: string; // scraping medium
  excerpt: string; // discord
  doc?: string; // google docs link, discord
  visuals?: string; // drive link, discord?
  article: string; // medium link, discord
}

const bot = new djs.Client({ intents: ["Guilds", "GuildMessages", "MessageContent"] });

bot.on("messageCreate", async (msg) => {
  if (msg.author.bot || msg.channelId.toString() != process.env.ARCHIVE_CHANNEL_ID) return;
  const lines = msg.content.split("\n").filter((str) => str !== "");

  if (lines.length !== 4) return; // We should see 4 lines from the post
  const { section, title } = getTitleAndSection(lines.shift()!);
  const excerpt = lines.shift()!;

  const googleDocsLink = lines.find((l) => l.startsWith("https://docs.google.com/"));
  const mediumLink = lines.find((l) => l.startsWith("https://tomasinoweb.medium.com/"));

  if (googleDocsLink == undefined || mediumLink == undefined)
    throw new Error("Was not able to find the google docs / medium link");

  const scraped = await scrape(mediumLink);

  const post: Post = {
    section,
    article_title: title,
    published_on: scraped.publishDate,
    byline_name: scraped.byline,
    featured_visual_credit: scraped.visualCredit,
    excerpt,
    doc: googleDocsLink,
    visuals: "",
    article: mediumLink,
  };

  // console.log(post);
  await push(post);
  await msg.react("✅");
});

bot.on("ready", () => {
  console.log("Bot is ready to process posts");
});

function getTitleAndSection(header: string) {
  if (header.includes("]") == false) throw new Error("The header does not contain a ] for the section");

  let currentCharIndex = 1; // start at 1 to consume the opening left bracket for the section
  let section = "";

  while (header[currentCharIndex] !== "]") {
    section += header[currentCharIndex];
    currentCharIndex++;
  }

  let title = header.substring(currentCharIndex + 2);
  return { section, title };
}

async function scrape(mediumLink: string) {
  const { data: rawHTML } = await axios.get(mediumLink);
  const root = HTMLParser.parse(rawHTML);
  const currentYear = new Date().getFullYear();

  const { text: publishDate } = root.querySelector(".pw-published-date")!.childNodes[0].childNodes[0];
  const { text: byline } = root.querySelectorAll(".pw-post-body-paragraph")[0].childNodes[0];
  const { text: visualCredit } = root.getElementsByTagName("figcaption")[0].childNodes[0];

  return {
    publishDate: dateFormat(new Date(publishDate).setFullYear(currentYear), "mmmm d, yyyy"),
    byline,
    visualCredit,
  };
}

bot.login(process.env.BOT_TOKEN);
