import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const songs = JSON.parse(fs.readFileSync(path.join(root, "data", "songs.json"), "utf8"));
const config = JSON.parse(fs.readFileSync(path.join(root, "site.config.json"), "utf8"));
const mediaLibrary = readJsonIfExists(path.join(root, "data", "media.json"), { artists: {}, songs: {} });

const site = {
  name: config.name,
  url: normalizeSiteUrl(config.siteUrl),
  description: config.description,
  contactEmail: config.contactEmail,
  googleAnalyticsId: config.googleAnalyticsId.trim(),
  adsenseClientId: config.adsenseClientId.trim(),
  adsensePublisherId: config.adsensePublisherId.trim(),
  searchConsoleVerification: config.searchConsoleVerification.trim(),
  spotifyPlaylistUrl: (config.spotifyPlaylistUrl || "").trim(),
  youtubePlaylistUrl: (config.youtubePlaylistUrl || "").trim(),
};

const byYear = groupBy(songs, (song) => song.year);
const byCountry = groupBy(songs, (song) => song.countrySlug);
const artists = buildArtists(songs);
const byArtist = groupByArtist(songs);
const siteUpdatedAt = latestDate(songs.map((song) => song.lastChecked));

cleanGenerated();
generateSongPages();
generateArtistPages();
generateCountryPages();
generateYearPages();
generateTimelinePage();
generateUtilityPages();
updateHomeIntegrations();
updateHomeStaticLinks();
generateSitemap();
generateRobots();
generateAdsTxt();

console.log(
  `Generated ${songs.length} song pages, ${artists.length} artist pages, ${byCountry.size} country pages, ${byYear.size} year pages.`
);

function cleanGenerated() {
  for (const dir of ["songs", "artists", "countries", "years", "timeline", "listen", "glossary", "about", "contact", "privacy"]) {
    fs.rmSync(path.join(root, dir), { recursive: true, force: true });
  }
  fs.rmSync(path.join(root, "sitemap.xml"), { force: true });
  fs.rmSync(path.join(root, "robots.txt"), { force: true });
  fs.rmSync(path.join(root, "ads.txt"), { force: true });
}

function generateSongPages() {
  for (const song of songs) {
    const songMedia = mediaForSong(song);
    const related = songs
      .filter((candidate) => candidate.slug !== song.slug)
      .filter(
        (candidate) =>
          candidate.year === song.year ||
          candidate.countrySlug === song.countrySlug ||
          candidate.type === song.type
      )
      .slice(0, 4);

    writePage(
      ["songs", song.slug],
      layout({
        title: `${song.title} World Cup Song: Year, Artist and Context`,
        description: song.summary,
        image: songMedia?.url,
        depth: 2,
        path: `/songs/${song.slug}/`,
        type: "article",
        schema: [articleSchema(song), songFaqSchema(song)],
        body: `
          <main class="article-page">
            ${breadcrumb("Songs")}
            <section class="detail-hero visual-hero">
              <div>
                <p class="kicker">${escapeHtml(song.status)} · ${escapeHtml(song.tournament)}</p>
                <h1>${escapeHtml(song.title)}</h1>
                ${heroListenActions(song)}
                <p>${escapeHtml(song.summary)}</p>
              </div>
              ${mediaFigure(songMedia, "hero-media", `${song.title} World Cup music visual`)}
            </section>
            <section class="detail-grid">
              <article class="detail-main">
                ${songReferencesSection(song)}
                ${songStorySection(song)}
                ${songExplainer(song)}
                ${watchSection(song)}
                ${songFaqSection(song)}
              </article>
              <aside class="detail-aside">
                ${statList(song, "../../")}
                ${adBox()}
              </aside>
            </section>
            ${commentSection({
              key: `worldcup:song:${song.slug}`,
              kicker: "Listener notes",
              title: "Song comments",
              placeholder: "Share a memory, correction, source, or question about this World Cup song...",
            })}
            ${relatedList("Related songs", related, "../../")}
          </main>
        `,
      })
    );
  }
}

function generateArtistPages() {
  writePage(
    ["artists"],
    layout({
      title: "World Cup Music Artists",
      description: "Browse artists, supporter groups, and teams connected to World Cup songs and fan anthems.",
      depth: 1,
      path: "/artists/",
      schema: artistCollectionSchema(),
      body: `
        <main class="article-page artist-index-page">
          ${simpleBreadcrumb("Artists", "../")}
          <section class="detail-hero">
            <p class="kicker">Artists and supporter groups</p>
            <h1>World Cup music artists</h1>
            <p>Browse the artists, supporter groups, and team contexts connected to official songs, soundtrack entries, classic tracks, and fan anthems.</p>
          </section>
          <section class="artist-grid" aria-label="World Cup music artists">
            ${artists.map((artist) => artistCard(artist, "../")).join("")}
          </section>
        </main>
      `,
    })
  );

  for (const artist of artists) {
    const artistSongs = byArtist.get(artist.slug) || [];
    const artistMedia = mediaForArtist(artist);
    writePage(
      ["artists", artist.slug],
      layout({
        title: `${artist.name} World Cup Songs and Music Context`,
        description: `Songs, tournament context, and source-backed notes for ${artist.name} on World Cup Music Atlas.`,
        image: artistMedia?.url,
        depth: 2,
        path: `/artists/${artist.slug}/`,
        schema: artistPageSchema(artist, artistSongs),
        body: `
          <main class="article-page artist-page">
            ${breadcrumb("Artists")}
            <section class="detail-hero artist-hero">
              ${artistMedia ? mediaFigure(artistMedia, "artist-portrait", `${artist.name} portrait`) : artistAvatar(artist)}
              <div>
                <p class="kicker">${escapeHtml(artist.kind)}</p>
                <h1>${escapeHtml(artist.name)}</h1>
                <p>${escapeHtml(artistSummary(artist, artistSongs))}</p>
              </div>
            </section>
            <section class="detail-grid">
              <article class="detail-main">
                <section class="explainer-stack" aria-label="${escapeHtml(artist.name)} artist profile">
                  <section class="explainer-block">
                    <h2>Why this artist appears here</h2>
                    <p>${escapeHtml(artistWhyHere(artist, artistSongs))}</p>
                  </section>
                  <section class="explainer-block">
                    <h2>World Cup music connections</h2>
                    <p>${escapeHtml(artistConnectionSummary(artistSongs))}</p>
                    ${artistSongLinks(artistSongs)}
                  </section>
                  <section class="explainer-block">
                    <h2>Official and source links</h2>
                    <p>This profile only links to official or reputable sources. It does not copy profile photos, social posts, lyrics, or biographies from external platforms.</p>
                    ${artistExternalLinks(artist, artistSongs)}
                  </section>
                  <section class="explainer-block">
                    <h2>Image policy</h2>
                    <p>${escapeHtml(artistImagePolicy(artist, artistMedia))}</p>
                  </section>
                </section>
              </article>
              <aside class="detail-aside">
                ${artistStatList(artist, artistSongs, artistMedia)}
                ${adBox()}
              </aside>
            </section>
            ${commentSection({
              key: `worldcup:artist:${artist.slug}`,
              kicker: "Reader notes",
              title: "Artist comments",
              placeholder: `Share a World Cup music note, correction, or question about ${artist.name}...`,
            })}
            ${relatedList("Related songs", artistSongs, "../../")}
          </main>
        `,
      })
    );
  }
}

function generateCountryPages() {
  for (const [countrySlug, countrySongs] of byCountry.entries()) {
    const country = countrySongs[0].country;
    writePage(
      ["countries", countrySlug],
      layout({
        title: `${country} World Cup Songs and Anthems`,
        description: `Browse World Cup songs, anthems, and soundtrack entries connected to ${country}.`,
        depth: 2,
        path: `/countries/${countrySlug}/`,
        schema: collectionSchema({
          title: `${country} World Cup music`,
          description: `Official songs, soundtrack entries, and useful music-history pages connected to ${country}.`,
          path: `/countries/${countrySlug}/`,
          items: countrySongs,
        }),
        body: `
          <main class="article-page">
            ${breadcrumb("Countries")}
            <section class="detail-hero">
              <p class="kicker">Country collection</p>
              <h1>${escapeHtml(country)} World Cup music</h1>
              <p>Official songs, soundtrack entries, and useful music-history pages connected to ${escapeHtml(country)}.</p>
            </section>
            ${collectionGrid(countrySongs, "../../")}
          </main>
        `,
      })
    );
  }
}

function generateYearPages() {
  for (const [year, yearSongs] of byYear.entries()) {
    writePage(
      ["years", year],
      layout({
        title: `${year} World Cup Songs and Soundtrack Guide`,
        description: `Browse World Cup songs and music context for ${year}.`,
        depth: 2,
        path: `/years/${year}/`,
        schema: collectionSchema({
          title: `${year} World Cup songs`,
          description: `A compact music guide for the ${year} tournament cycle.`,
          path: `/years/${year}/`,
          items: yearSongs,
        }),
        body: `
          <main class="article-page">
            ${breadcrumb("Years")}
            <section class="detail-hero">
              <p class="kicker">Tournament year</p>
              <h1>${escapeHtml(year)} World Cup songs</h1>
              <p>A compact music guide for the ${escapeHtml(year)} tournament cycle.</p>
            </section>
            ${collectionGrid(yearSongs, "../../")}
          </main>
        `,
      })
    );
  }
}

function generateTimelinePage() {
  const timelineSongs = timelineItems();
  const timelineYears = new Set(timelineSongs.map((song) => song.year));

  writePage(
    ["timeline"],
    layout({
      title: "World Cup Songs Timeline",
      description: "Browse World Cup songs, anthems, fan chants, and soundtrack entries by tournament year.",
      depth: 1,
      path: "/timeline/",
      schema: collectionSchema({
        title: "World Cup songs timeline",
        description:
          "A curated visual timeline of World Cup songs, anthems, fan chants, and soundtrack moments.",
        path: "/timeline/",
        items: timelineSongs,
      }),
      body: `
        <main class="article-page timeline-page">
          ${simpleBreadcrumb("Timeline", "../")}
          <section class="timeline-hero">
            <div>
              <p class="kicker">Visual timeline</p>
              <h1>World Cup songs through time</h1>
              <p>Not every track needs the spotlight. This timeline follows the music moments people keep searching for: official songs, fan anthems, ceremony tracks, and the hits that outlived their tournament.</p>
            </div>
            <div class="timeline-summary" aria-label="Timeline summary">
              <strong>${timelineSongs.length}</strong>
              <span>featured moments</span>
              <strong>${timelineYears.size}</strong>
              <span>tournament years</span>
            </div>
          </section>
          <section class="timeline-track" aria-label="World Cup music timeline">
            ${timelineSongs
              .map((song, index) => timelineNode(song, index, timelineSongs.findIndex((item) => item.year === song.year) === index))
              .join("")}
          </section>
          ${timelineAnimationScript()}
        </main>
      `,
    })
  );
}

function timelineItems() {
  const featured = songs.filter((song) => song.timelineFeatured);
  const source = featured.length ? featured : Array.from(byYear.values()).flatMap((yearSongs) => sortedSongs(yearSongs).slice(0, 1));
  return source.sort((left, right) => {
    const yearDelta = Number(right.year) - Number(left.year);
    if (yearDelta !== 0) return yearDelta;
    return (left.timelineRank ?? 99) - (right.timelineRank ?? 99);
  });
}

function timelineNode(song, index, isFirstInYear) {
  const allYearSongs = byYear.get(song.year) || [];
  const hiddenCount = Math.max(0, allYearSongs.length - allYearSongs.filter((item) => item.timelineFeatured).length);
  const note = song.timelineNote || song.summary;
  const side = index % 2 === 0 ? "right" : "left";
  const delay = `${Math.min(index * 70, 560)}ms`;

  return `<article class="timeline-node ${side}" style="--reveal-delay: ${delay}">
    <div class="timeline-dot" aria-hidden="true"></div>
    <div class="timeline-date">
      <span>${escapeHtml(song.year)}</span>
      <small>${escapeHtml(song.status)}</small>
    </div>
    <div class="timeline-card">
      <div class="song-meta">
        <span class="pill ${song.type}">${escapeHtml(song.type)}</span>
        <span class="pill">${escapeHtml(song.country)}</span>
        <span class="pill">${escapeHtml(song.language)}</span>
      </div>
      <h2>${escapeHtml(song.title)}</h2>
      <p class="artist">${artistInlineLinks(song, "../")}</p>
      <p>${escapeHtml(note)}</p>
      <div class="timeline-actions">
        <a class="button primary" href="../songs/${encodeURIComponent(song.slug)}/">Open story</a>
        <a class="button secondary" href="../years/${encodeURIComponent(song.year)}/">${escapeHtml(song.year)} collection</a>
      </div>
      ${
        isFirstInYear && hiddenCount > 0
          ? `<p class="timeline-more">${hiddenCount} more ${escapeHtml(song.year)} ${hiddenCount === 1 ? "entry" : "entries"} in the full collection.</p>`
          : ""
      }
    </div>
  </article>`;
}

function timelineAnimationScript() {
  return `<script>
    (() => {
      const page = document.querySelector(".timeline-page");
      const nodes = Array.from(document.querySelectorAll(".timeline-node"));
      const reveal = () => {
        nodes.forEach((node) => {
          const rect = node.getBoundingClientRect();
          if (rect.top < window.innerHeight * 0.82) node.classList.add("is-visible");
        });
        const track = document.querySelector(".timeline-track");
        if (!track || !page) return;
        const rect = track.getBoundingClientRect();
        const total = rect.height - window.innerHeight * 0.35;
        const progress = Math.min(1, Math.max(0, (window.innerHeight * 0.2 - rect.top) / total));
        page.style.setProperty("--timeline-progress", progress.toFixed(3));
      };
      reveal();
      window.addEventListener("scroll", reveal, { passive: true });
      window.addEventListener("resize", reveal);
    })();
  </script>`;
}

function generateSitemap() {
  const urls = [
    { path: "/", lastmod: siteUpdatedAt, changefreq: "daily", priority: "1.0" },
    { path: "/artists/", lastmod: siteUpdatedAt, changefreq: "weekly", priority: "0.8" },
    { path: "/timeline/", lastmod: siteUpdatedAt, changefreq: "weekly", priority: "0.8" },
    { path: "/listen/", lastmod: siteUpdatedAt, changefreq: "weekly", priority: "0.8" },
    { path: "/glossary/", lastmod: siteUpdatedAt, changefreq: "monthly", priority: "0.7" },
    { path: "/about/", lastmod: siteUpdatedAt, changefreq: "monthly", priority: "0.3" },
    { path: "/contact/", lastmod: siteUpdatedAt, changefreq: "monthly", priority: "0.2" },
    { path: "/privacy/", lastmod: siteUpdatedAt, changefreq: "yearly", priority: "0.1" },
  ];
  for (const song of songs) {
    urls.push({
      path: `/songs/${song.slug}/`,
      lastmod: song.lastChecked,
      changefreq: song.year === "2026" ? "daily" : "monthly",
      priority: song.year === "2026" ? "0.9" : "0.7",
    });
  }
  for (const artist of artists) {
    const artistSongs = byArtist.get(artist.slug) || [];
    urls.push({
      path: `/artists/${artist.slug}/`,
      lastmod: latestDate(artistSongs.map((song) => song.lastChecked)),
      changefreq: "monthly",
      priority: "0.6",
    });
  }
  for (const [countrySlug, countrySongs] of byCountry.entries()) {
    urls.push({
      path: `/countries/${countrySlug}/`,
      lastmod: latestDate(countrySongs.map((song) => song.lastChecked)),
      changefreq: "weekly",
      priority: "0.6",
    });
  }
  for (const [year, yearSongs] of byYear.entries()) {
    urls.push({
      path: `/years/${year}/`,
      lastmod: latestDate(yearSongs.map((song) => song.lastChecked)),
      changefreq: year === "2026" ? "daily" : "monthly",
      priority: year === "2026" ? "0.8" : "0.5",
    });
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (entry) => `  <url>
    <loc>${site.url}${entry.path}</loc>
    <lastmod>${entry.lastmod}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`
  )
  .join("\n")}
</urlset>
`;
  fs.writeFileSync(path.join(root, "sitemap.xml"), xml);
}

function generateRobots() {
  const content = `User-agent: *
Allow: /

Sitemap: ${site.url}/sitemap.xml
`;
  fs.writeFileSync(path.join(root, "robots.txt"), content);
}

function generateAdsTxt() {
  if (!site.adsensePublisherId) return;
  const content = `google.com, ${site.adsensePublisherId}, DIRECT, f08c47fec0942fa0
`;
  fs.writeFileSync(path.join(root, "ads.txt"), content);
}

function updateHomeIntegrations() {
  const indexPath = path.join(root, "index.html");
  const html = fs.readFileSync(indexPath, "utf8");
  const integrations = headIntegrations();
  const markerRegex =
    /    <!-- GOOGLE_INTEGRATIONS_START -->[\s\S]*?    <!-- GOOGLE_INTEGRATIONS_END -->/;
  const block = `    <!-- GOOGLE_INTEGRATIONS_START -->\n${indentBlock(integrations, 4)}\n    <!-- GOOGLE_INTEGRATIONS_END -->`;
  const nextHtml = markerRegex.test(html)
    ? html.replace(markerRegex, block)
    : html.replace(
        "    <!-- Google integrations are injected into generated pages by tools/build.mjs after site.config.json is filled. -->",
        block
      );
  fs.writeFileSync(indexPath, nextHtml);
}

function updateHomeStaticLinks() {
  const indexPath = path.join(root, "index.html");
  const html = fs.readFileSync(indexPath, "utf8");
  const block = homepageStaticLinks();
  const nextHtml = html.replace(
    /<div class="generated-links" id="generatedLinks" aria-live="polite">[\s\S]*?<\/div>\s*<\/section>/,
    `<div class="generated-links" id="generatedLinks" aria-live="polite">\n${indentBlock(block, 10)}\n        </div>\n      </section>`
  );
  fs.writeFileSync(indexPath, nextHtml);
}

function homepageStaticLinks() {
  const countries = Array.from(byCountry.entries())
    .map(([slug, countrySongs]) => [slug, countrySongs[0].country])
    .sort((left, right) => left[1].localeCompare(right[1]));
  const years = Array.from(byYear.keys()).sort((left, right) => Number(right) - Number(left));
  return `<div>
  <h3>Explore the atlas</h3>
  <p>Browse songs, countries, tournament years, timeline highlights, and plain-English music terms.</p>
</div>
<div class="link-cloud" aria-label="Atlas browsing links">
  <a href="artists/">Artists</a>
  <a href="timeline/">Timeline</a>
  <a href="listen/">Listen</a>
  <a href="glossary/">Glossary</a>
  ${songs.map((song) => `<a href="songs/${encodeURIComponent(song.slug)}/">${escapeHtml(song.title)}</a>`).join("\n  ")}
  ${countries.map(([slug, label]) => `<a href="countries/${encodeURIComponent(slug)}/">${escapeHtml(label)}</a>`).join("\n  ")}
  ${years.map((year) => `<a href="years/${encodeURIComponent(year)}/">${escapeHtml(year)}</a>`).join("\n  ")}
</div>
<p class="index-note">Use these links to jump straight into the song history, country context, or tournament year you remember.</p>`;
}

function playlistCard({ eyebrow, title, body, url, label, className }) {
  if (!url) return "";
  return `<article class="playlist-card ${className}">
    <p class="kicker">${escapeHtml(eyebrow)}</p>
    <h2>${escapeHtml(title)}</h2>
    <p>${escapeHtml(body)}</p>
    <a class="button primary" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a>
  </article>`;
}

function generateUtilityPages() {
  writePage(
    ["listen"],
    layout({
      title: "Listen to World Cup Songs and Fan Anthems",
      description:
        "Open the World Cup Music Atlas Spotify and YouTube playlists for official World Cup songs, classic tournament tracks, and fan anthems.",
      depth: 1,
      path: "/listen/",
      schema: simplePageSchema("Listen", `Official playlist links for ${site.name}.`, "/listen/"),
      body: `
        <main class="article-page listen-page">
          ${simpleBreadcrumb("Listen", "../")}
          <section class="detail-hero">
            <p class="kicker">Official platform links</p>
            <h1>Listen to the atlas</h1>
            <p>Open the public Spotify and YouTube playlists that collect songs referenced across ${escapeHtml(site.name)}. The site explains the context; Spotify and YouTube handle licensed playback.</p>
          </section>
          <section class="listen-grid" aria-label="World Cup Music Atlas playlists">
            ${playlistCard({
              eyebrow: "Spotify playlist",
              title: "World Cup Music Atlas: Songs & Fan Anthems",
              body:
                "A starter listening list for official songs, classic tournament tracks, and fan favorites. Availability can vary by country.",
              url: site.spotifyPlaylistUrl,
              label: "Open on Spotify",
              className: "spotify-card",
            })}
            ${playlistCard({
              eyebrow: "YouTube playlist",
              title: "World Cup Music Atlas: Songs & Fan Anthems",
              body:
                "A public video playlist for official uploads and platform-safe watching as the archive grows.",
              url: site.youtubePlaylistUrl,
              label: "Open on YouTube",
              className: "youtube-card",
            })}
          </section>
          <section class="context-section" aria-labelledby="rights-title">
            <h2 id="rights-title">How these playlists are used</h2>
            <p>${escapeHtml(site.name)} links out to official or reputable platform pages instead of hosting copyrighted audio, copied videos, or lyrics. Song pages keep the editorial context here, then send listeners to licensed platforms.</p>
          </section>
        </main>
      `,
    })
  );

  writePage(
    ["glossary"],
    layout({
      title: "World Cup Music Glossary",
      description:
        "Plain-English definitions for official song, anthem, fan anthem, chant, and soundtrack terms in World Cup music.",
      depth: 1,
      path: "/glossary/",
      schema: faqPageSchema(),
      body: `
        <main class="article-page glossary-page">
          ${simpleBreadcrumb("Glossary", "../")}
          <section class="detail-hero">
            <p class="kicker">Glossary</p>
            <h1>World Cup music terms, explained</h1>
            <p>Use this page when a song is everywhere but the label is confusing: official song, anthem, soundtrack single, fan anthem, chant, or ceremony track.</p>
          </section>
          <section class="glossary-grid" aria-label="World Cup music glossary">
            ${glossaryEntries().map((entry) => glossaryCard(entry)).join("")}
          </section>
          <section class="faq-section" aria-labelledby="faq-title">
            <h2 id="faq-title">Quick answers</h2>
            ${glossaryFaqs().map((item) => faqItem(item)).join("")}
          </section>
        </main>
      `,
    })
  );

  writePage(
    ["about"],
    layout({
      title: "About",
      description: `${site.name} is an independent guide to World Cup songs, official anthems, soundtrack tracks, and fan music culture.`,
      depth: 1,
      path: "/about/",
      schema: simplePageSchema(
        "About",
        `${site.name} is an independent guide to World Cup songs, official anthems, soundtrack tracks, and fan music culture.`,
        "/about/"
      ),
      body: `
        <main class="article-page utility-page">
          ${simpleBreadcrumb("About", "../")}
          <section class="detail-hero">
            <p class="kicker">About</p>
            <h1>About ${escapeHtml(site.name)}</h1>
            <p>An independent editorial guide to World Cup songs, official anthems, soundtrack tracks, and fan music culture.</p>
          </section>
          <article class="detail-main">
            <h2>What this site does</h2>
            <p>
              ${escapeHtml(site.name)} collects and explains the music people search for around the
              FIFA World Cup: official songs, tournament anthems, soundtrack singles, opening ceremony
              performances, and fan anthems that become part of matchday culture.
            </p>
            <p>
              The goal is simple: help readers quickly understand what a song is, which tournament it
              belongs to, who performs it, whether it is official or fan-led, and where to listen on
              licensed platforms.
            </p>
            <h2>Editorial approach</h2>
            <p>
              Pages use original summaries, compact metadata, and links to primary or reputable public
              sources. Labels such as official song, anthem, soundtrack single, fan anthem, and chant
              follow the source wording as closely as possible.
            </p>
            <p>
              We do not reproduce lyrics, host audio files, upload copied video, or treat unofficial fan
              chants as official tournament songs. Listening links point to platforms such as Spotify,
              YouTube, or cited source pages instead.
            </p>
            <h2>Independence</h2>
            <p>
              ${escapeHtml(site.name)} is independently maintained and is not affiliated with FIFA,
              Spotify, YouTube, national football associations, artists, labels, or tournament organizers.
              Trademarks and platform names belong to their respective owners.
            </p>
            <h2>Corrections and rights questions</h2>
            <p>
              Music credits, official labels, and platform availability can change. If you notice a
              mistake, have a source suggestion, or need to raise a rights concern, email
              <a class="text-link" href="mailto:${escapeHtml(site.contactEmail)}">${escapeHtml(site.contactEmail)}</a>.
            </p>
          </article>
        </main>
      `,
    })
  );

  writePage(
    ["contact"],
    layout({
      title: "Contact",
      description: `Contact ${site.name}.`,
      depth: 1,
      path: "/contact/",
      schema: simplePageSchema("Contact", `Contact ${site.name}.`, "/contact/"),
      body: `
        <main class="article-page utility-page">
          ${simpleBreadcrumb("Contact", "../")}
          <section class="detail-hero">
            <p class="kicker">Contact</p>
            <h1>Contact us</h1>
            <p>Send corrections, source suggestions, advertising questions, or rights concerns.</p>
          </section>
          <article class="detail-main">
            <h2>Email</h2>
            <p>
              <a class="text-link" href="mailto:${escapeHtml(site.contactEmail)}">${escapeHtml(site.contactEmail)}</a>
            </p>
            <h2>Corrections</h2>
            <p>
              Music credits and tournament context can change as official releases are updated.
              Please include a source link when submitting a correction.
            </p>
          </article>
        </main>
      `,
    })
  );

  writePage(
    ["privacy"],
    layout({
      title: "Privacy Policy",
      description: `${site.name} privacy policy.`,
      depth: 1,
      path: "/privacy/",
      schema: simplePageSchema("Privacy Policy", `${site.name} privacy policy.`, "/privacy/"),
      body: `
        <main class="article-page utility-page">
          ${simpleBreadcrumb("Privacy", "../")}
          <section class="detail-hero">
            <p class="kicker">Privacy</p>
            <h1>Privacy Policy</h1>
            <p>This policy explains the basic analytics, advertising, and contact-data practices for this static website.</p>
          </section>
          <article class="detail-main">
            <h2>Analytics</h2>
            <p>
              If Google Analytics is enabled, this site may collect aggregate usage data such as
              page views, referring pages, approximate geography, browser, and device information.
            </p>
            <h2>Advertising</h2>
            <p>
              If Google AdSense or another advertising partner is enabled, advertising providers may
              use cookies or similar technologies to measure ads and personalize or limit ad delivery
              according to their own policies.
            </p>
            <h2>Contact</h2>
            <p>
              If you email us, we use your message and email address only to respond to your request.
            </p>
            <h2>Content and rights</h2>
            <p>
              This site links to external music and source pages instead of hosting copyrighted audio
              or reproducing lyrics. Contact us if a correction or rights review is needed.
            </p>
            <h2>Contact</h2>
            <p>
              Questions can be sent to
              <a class="text-link" href="mailto:${escapeHtml(site.contactEmail)}">${escapeHtml(site.contactEmail)}</a>.
            </p>
            <p class="policy-date">Last updated: June 29, 2026.</p>
          </article>
        </main>
      `,
    })
  );
}

function layout({ title, description, depth, path: pagePath, type = "website", schema, body, image }) {
  const prefix = "../".repeat(depth);
  const canonicalUrl = `${site.url}${pagePath}`;
  const imageUrl = image || `${site.url}/assets/hero-world-cup-music.png`;
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)} | ${site.name}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${canonicalUrl}" />
    <meta property="og:site_name" content="${escapeHtml(site.name)}" />
    <meta property="og:type" content="${escapeHtml(type)}" />
    <meta property="og:title" content="${escapeHtml(title)} | ${escapeHtml(site.name)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:image" content="${imageUrl}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)} | ${escapeHtml(site.name)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${imageUrl}" />
    ${headIntegrations()}
    <link rel="icon" href="${prefix}assets/favicon.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="${prefix}styles.css" />
    ${schema ? `<script type="application/ld+json">${escapeJsonLd(schema)}</script>` : ""}
  </head>
  <body>
    <header class="site-header">
      <a class="brand" href="${prefix}index.html" aria-label="${site.name} home">
        <span class="brand-mark">♪</span>
        <span>${site.name}</span>
      </a>
      <nav aria-label="Primary navigation">
        <a href="${prefix}index.html#trending">Trending</a>
        <a href="${prefix}index.html#library">Library</a>
        <a href="${prefix}artists/">Artists</a>
        <a href="${prefix}timeline/">Timeline</a>
        <a href="${prefix}listen/">Listen</a>
        <a href="${prefix}glossary/">Glossary</a>
        <a href="${prefix}about/">About</a>
      </nav>
    </header>
    ${body}
    <footer class="site-footer">
      <p>${site.name} publishes original summaries and links to official or reputable music sources.</p>
      <div class="footer-links">
        <a href="${prefix}artists/">Artists</a>
        <a href="${prefix}timeline/">Timeline</a>
        <a href="${prefix}listen/">Listen</a>
        <a href="${prefix}glossary/">Glossary</a>
        <a href="${prefix}about/">About</a>
        <a href="${prefix}contact/">Contact</a>
        <a href="${prefix}privacy/">Privacy</a>
        <a href="${prefix}index.html">Home</a>
      </div>
    </footer>
    <script src="${prefix}script.js"></script>
  </body>
</html>
`;
}

function breadcrumb(label) {
  return `<nav class="breadcrumb" aria-label="Breadcrumb">
    <a href="../../index.html">Home</a>
    <span>/</span>
    <a href="../../index.html#library">${escapeHtml(label)}</a>
  </nav>`;
}

function simpleBreadcrumb(label, homeHref) {
  return `<nav class="breadcrumb" aria-label="Breadcrumb">
    <a href="${homeHref}index.html">Home</a>
    <span>/</span>
    <span>${escapeHtml(label)}</span>
  </nav>`;
}

function headIntegrations() {
  const tags = [];
  if (site.searchConsoleVerification) {
    tags.push(
      `<meta name="google-site-verification" content="${escapeHtml(site.searchConsoleVerification)}" />`
    );
  }
  if (site.googleAnalyticsId) {
    tags.push(`<script async src="https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(site.googleAnalyticsId)}"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${escapeJs(site.googleAnalyticsId)}');
    </script>`);
  }
  if (site.adsenseClientId) {
    tags.push(
      `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(site.adsenseClientId)}" crossorigin="anonymous"></script>`
    );
  }
  return tags.join("\n    ");
}

function articleSchema(song) {
  const songMedia = mediaForSong(song);
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: `${song.title} World Cup Song: Year, Artist and Context`,
    description: song.summary,
    mainEntityOfPage: `${site.url}/songs/${song.slug}/`,
    dateModified: song.lastChecked,
    author: {
      "@type": "Organization",
      name: site.name,
    },
    publisher: {
      "@type": "Organization",
      name: site.name,
      url: site.url,
    },
    about: [
      song.title,
      song.artist,
      song.tournament,
      song.country,
      song.status,
    ],
    citation: song.sourceUrl,
    image: songMedia?.url,
    inLanguage: "en",
  };
}

function collectionSchema({ title, description, path: pagePath, items }) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: title,
    description,
    url: `${site.url}${pagePath}`,
    isPartOf: {
      "@type": "WebSite",
      name: site.name,
      url: site.url,
    },
    mainEntity: {
      "@type": "ItemList",
      itemListElement: items.map((song, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: song.title,
        url: `${site.url}/songs/${song.slug}/`,
      })),
    },
    inLanguage: "en",
  };
}

function artistCollectionSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "World Cup Music Artists",
    description: "Artists, supporter groups, and teams connected to World Cup music pages.",
    url: `${site.url}/artists/`,
    isPartOf: {
      "@type": "WebSite",
      name: site.name,
      url: site.url,
    },
    mainEntity: {
      "@type": "ItemList",
      itemListElement: artists.map((artist, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: artist.name,
        url: `${site.url}/artists/${artist.slug}/`,
      })),
    },
    inLanguage: "en",
  };
}

function artistPageSchema(artist, artistSongs) {
  const artistMedia = mediaForArtist(artist);
  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    name: `${artist.name} World Cup music profile`,
    description: artistSummary(artist, artistSongs),
    url: `${site.url}/artists/${artist.slug}/`,
    isPartOf: {
      "@type": "WebSite",
      name: site.name,
      url: site.url,
    },
    mainEntity: {
      "@type": artist.kind === "Artist" ? "Person" : "Organization",
      name: artist.name,
      image: artistMedia?.url,
      description: artistWhyHere(artist, artistSongs),
      subjectOf: artistSongs.map((song) => ({
        "@type": "MusicRecording",
        name: song.title,
        url: `${site.url}/songs/${song.slug}/`,
      })),
    },
    inLanguage: "en",
  };
}

function simplePageSchema(title, description, pagePath) {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: title,
    description,
    url: `${site.url}${pagePath}`,
    isPartOf: {
      "@type": "WebSite",
      name: site.name,
      url: site.url,
    },
    inLanguage: "en",
  };
}

function faqPageSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    name: "World Cup Music Glossary",
    description:
      "Plain-English definitions for official song, anthem, fan anthem, chant, and soundtrack terms in World Cup music.",
    url: `${site.url}/glossary/`,
    mainEntity: glossaryFaqs().map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
    inLanguage: "en",
  };
}

function glossaryEntries() {
  return [
    {
      term: "Official song",
      label: "Organizer label",
      text: "A song presented by FIFA or tournament organizers as an official tournament song. It is usually the safest label to use only when the source clearly says official song.",
      link: "songs/waka-waka/",
      linkText: "Example: Waka Waka",
    },
    {
      term: "Official anthem",
      label: "Organizer label",
      text: "An anthem can be part of the official music program, but it is not always the same thing as the main official song. The exact label should follow the source.",
      link: "songs/dna/",
      linkText: "Example: DNA",
    },
    {
      term: "Soundtrack single",
      label: "Music program",
      text: "A track released as part of a broader tournament album or music program. Useful pages explain where it sits in the album instead of calling every track the song.",
      link: "years/2026/",
      linkText: "Browse 2026 tracks",
    },
    {
      term: "Fan anthem",
      label: "Supporter culture",
      text: "A song supporters adopt and repeat around a team, player, or tournament moment. It may be culturally huge while still being unofficial.",
      link: "songs/muchachos-argentina/",
      linkText: "Example: Muchachos",
    },
    {
      term: "Chant",
      label: "Stadium use",
      text: "A short crowd vocal pattern, often adapted from an existing song. A chant page should explain context and origin without reproducing lyrics.",
      link: "countries/argentina/",
      linkText: "Browse fan songs",
    },
    {
      term: "Ceremony track",
      label: "Event moment",
      text: "Music tied to an opening ceremony, live performance, or broadcast moment. It can drive search demand even when it is not the headline tournament song.",
      link: "songs/dreamers/",
      linkText: "Example: Dreamers",
    },
  ];
}

function glossaryFaqs() {
  return [
    {
      question: "Is a fan anthem an official World Cup song?",
      answer:
        "Usually no. A fan anthem is a supporter-adopted song unless FIFA, a federation, or another official source explicitly labels it official.",
    },
    {
      question: "Why does one tournament have several songs?",
      answer:
        "Modern tournaments can have a main song, an anthem, ceremony music, and album tracks. A useful guide separates those labels instead of treating every release as the same thing.",
    },
    {
      question: "Can this site show lyrics or host songs?",
      answer:
        "No. The site uses original summaries and links to official or reputable listening sources. It does not reproduce lyrics, host audio, or upload copied video.",
    },
    {
      question: "What should I check before calling a song official?",
      answer:
        "Check the source label first. If FIFA or the organizer says official song, anthem, album track, or soundtrack single, use that exact wording.",
    },
  ];
}

function glossaryCard(entry) {
  return `<article class="definition-card">
    <span>${escapeHtml(entry.label)}</span>
    <h2>${escapeHtml(entry.term)}</h2>
    <p>${escapeHtml(entry.text)}</p>
    <a class="text-link" href="../${entry.link}">${escapeHtml(entry.linkText)}</a>
  </article>`;
}

function faqItem(item) {
  return `<article class="faq-item">
    <h3>${escapeHtml(item.question)}</h3>
    <p>${escapeHtml(item.answer)}</p>
  </article>`;
}

function statList(song, prefix) {
  const stats = [
    ["Artist", artistInlineLinks(song, prefix), true],
    ["Year", song.year],
    ["Tournament", song.tournament],
    ["Country", song.country],
    ["Language", song.language],
    ["Type", song.status],
    ["Checked", song.lastChecked],
  ];
  return `<dl class="stat-list">
    ${stats
      .map(
        ([key, value, isHtml]) => `<div>
          <dt>${escapeHtml(key)}</dt>
          <dd>${isHtml ? value : escapeHtml(value)}</dd>
        </div>`
      )
      .join("")}
  </dl>`;
}

function watchSection(song) {
  const actions = listeningActions(song);
  const embed = song.youtubeId
    ? `<div class="video-frame">
        <iframe
          src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(song.youtubeId)}"
          title="${escapeHtml(song.title)} official video"
          loading="lazy"
          referrerpolicy="strict-origin-when-cross-origin"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowfullscreen
        ></iframe>
      </div>`
    : `<div class="watch-placeholder">
        <strong>${song.watchUrl ? "Open the official video or stream" : "Open the song on a licensed platform"}</strong>
        <p>${
          song.watchUrl
            ? "Some official videos only play on their original platform. Spotify availability can also vary by country."
            : "Use Spotify search and source links below. We do not embed unofficial uploads or host copyrighted audio."
        }</p>
      </div>`;

  return `<section class="watch-section" aria-labelledby="watch-title-${escapeHtml(song.slug)}">
    <div class="watch-heading">
      <p class="kicker">Watch / Listen</p>
      <h2 id="watch-title-${escapeHtml(song.slug)}">Official listening links</h2>
    </div>
    ${embed}
    <div class="watch-actions">
      ${actions
        .map(
          (action) =>
            `<a class="button ${action.style}" href="${escapeHtml(action.url)}"${action.external ? ' target="_blank" rel="noreferrer"' : ""}>${escapeHtml(action.label)}</a>`
        )
        .join("")}
    </div>
    ${atlasPlaylistActions()}
    <p class="rights-note">No lyrics, audio files, or copied video are hosted on this site.</p>
  </section>`;
}

function atlasPlaylistActions() {
  const links = [
    site.spotifyPlaylistUrl
      ? `<a class="text-link platform-link" href="${escapeHtml(site.spotifyPlaylistUrl)}" target="_blank" rel="noreferrer">Atlas Spotify playlist</a>`
      : "",
    site.youtubePlaylistUrl
      ? `<a class="text-link platform-link" href="${escapeHtml(site.youtubePlaylistUrl)}" target="_blank" rel="noreferrer">Atlas YouTube playlist</a>`
      : "",
  ].filter(Boolean);
  if (!links.length) return "";
  return `<div class="playlist-actions" aria-label="Atlas playlist links">
    <span>Playlists:</span>
    ${links.join("\n    ")}
  </div>`;
}

function heroListenActions(song) {
  const actions = [
    {
      label: song.spotifyUrl ? "Listen on Spotify" : "Find on Spotify",
      url: song.spotifyUrl || spotifySearchUrl(song),
      style: "primary",
      external: true,
    },
  ];

  if (song.watchUrl) {
    actions.push({
      label: "Watch video",
      url: song.watchUrl,
      style: "secondary",
      external: true,
    });
  }

  return `<div class="quick-listen" aria-label="Quick listening links">
    <span>Listen</span>
    ${actions
      .map(
        (action) =>
          `<a class="listen-chip ${action.style}" href="${escapeHtml(action.url)}"${action.external ? ' target="_blank" rel="noreferrer"' : ""}>${escapeHtml(action.label)}</a>`
      )
      .join("")}
  </div>`;
}

function listeningActions(song) {
  const actions = [];
  actions.push({
    label: song.spotifyUrl ? "Open Spotify web" : "Find on Spotify",
    url: song.spotifyUrl || spotifySearchUrl(song),
    style: "primary platform-spotify",
    external: true,
  });
  actions.push({
    label: "Open app",
    url: spotifyAppUri(song),
    style: "secondary platform-spotify-app",
    external: false,
  });
  if (song.watchUrl) {
    actions.push({
      label: song.watchLabel || "Watch official video",
      url: song.watchUrl,
      style: "secondary",
      external: true,
    });
  }
  if (song.sourceUrl && song.sourceUrl !== song.watchUrl) {
    actions.push({
      label: song.sourceLabel || "Source",
      url: song.sourceUrl,
      style: "secondary",
      external: true,
    });
  }
  return actions;
}

function spotifySearchUrl(song) {
  return `https://open.spotify.com/search/${encodeURIComponent(`${song.title} ${song.artist}`)}`;
}

function spotifyAppUri(song) {
  return spotifyUriFromUrl(song.spotifyUrl) || `spotify:search:${encodeURIComponent(`${song.title} ${song.artist}`)}`;
}

function spotifyUriFromUrl(url) {
  if (!url) return null;
  const match = url.match(/^https?:\/\/open\.spotify\.com\/(track|album|playlist|artist)\/([A-Za-z0-9]+)/);
  if (!match) return null;
  return `spotify:${match[1]}:${match[2]}`;
}

function songExplainer(song) {
  const sections = [
    {
      title: "What is this song?",
      body: whatIsSong(song),
    },
    {
      title: "Is it official?",
      body: officialStatusAnswer(song),
    },
    {
      title: "Who performs it?",
      body: performerAnswer(song),
    },
    {
      title: "Language and country context",
      body: languageContextAnswer(song),
      extra: contextExtras(song),
    },
    {
      title: "When was it used?",
      body: usageTimingAnswer(song),
    },
    {
      title: "Why fans search for it",
      body: searchIntentAnswer(song),
      extra: searchAngleList(song),
    },
  ];

  return `<section class="explainer-stack" aria-label="${escapeHtml(song.title)} explainer">
    ${sections.map((section) => explainerBlock(section)).join("")}
  </section>`;
}

function songStorySection(song) {
  const cards = songStoryCards(song);
  return `<section class="story-lab" aria-labelledby="story-title-${escapeHtml(song.slug)}">
    <div class="story-lab-heading">
      <p class="kicker">${escapeHtml(storyKicker(song))}</p>
      <h2 id="story-title-${escapeHtml(song.slug)}">${escapeHtml(storyTitle(song))}</h2>
      <p>${escapeHtml(storyIntro(song))}</p>
    </div>
    <div class="story-card-grid">
      ${cards.map((card, index) => storyCard(card, index === 0)).join("")}
    </div>
    ${sourceTrail(song)}
  </section>`;
}

function storyKicker(song) {
  if (song.type === "fan") return "Fan culture notes";
  if (song.year === "2026") return "2026 watch notes";
  if (song.type === "classic") return "Classic song notes";
  return "Behind the song";
}

function storyTitle(song) {
  if (song.type === "fan") return "Why supporters attached to it";
  if (song.year === "2026") return "What to watch as this track develops";
  if (song.type === "classic") return "Why it keeps coming back";
  return "The context behind the listing";
}

function storyIntro(song) {
  if (song.story) return song.story;
  if (song.type === "fan") {
    return `${song.title} is useful as a supporter-culture entry: the important story is not only who recorded it, but when fans use it and why it travels through match memory.`;
  }
  if (song.year === "2026") {
    return `${song.title} is part of a live tournament cycle. This page should become more specific as official videos, performances, and fan reactions appear.`;
  }
  return `${song.title} is tracked here because tournament songs often return through memory first: a year, a host country, a performer, or a phrase people remember without knowing the full context.`;
}

function songStoryCards(song) {
  const cards = [
    {
      title: song.type === "fan" ? "The fan angle" : "The useful distinction",
      body: officialStatusAnswer(song),
    },
    {
      title: "Why people search it",
      body: song.whyItMatters,
      list: song.searchAngles,
    },
    {
      title: "Rights-safe listening",
      body: "This page explains the context in original wording and sends visitors to official, licensed, or reputable platforms for audio, video, and source material.",
      links: rightsSafeLinks(song),
    },
  ];

  if (Array.isArray(song.facts) && song.facts.length > 0) {
    cards.splice(1, 0, {
      title: "Quick notes",
      body: "These are the compact editorial notes worth checking before calling the track official, fan-made, classic, or current-cycle.",
      list: song.facts,
    });
  }

  if (Array.isArray(song.people) && song.people.length > 0) {
    cards.push({
      title: "People and context",
      body: "Open the linked context pages when you need names, teams, or artist background. The atlas does not copy biographies from external sites.",
      people: song.people,
    });
  }

  return cards;
}

function storyCard(card, open) {
  return `<details class="story-card"${open ? " open" : ""}>
    <summary>
      <span>${escapeHtml(card.title)}</span>
      <strong>Read</strong>
    </summary>
    <div class="story-card-body">
      <p>${escapeHtml(card.body)}</p>
      ${card.list ? storyList(card.list) : ""}
      ${card.links ? storyLinks(card.links) : ""}
      ${card.people ? `<div class="people-links story-people-links">${card.people.map((person) => personLink(person)).join("")}</div>` : ""}
    </div>
  </details>`;
}

function storyList(items) {
  return `<ul class="context-facts story-facts">
    ${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
  </ul>`;
}

function storyLinks(links) {
  if (!links.length) return "";
  return `<div class="story-links">
    ${links
      .map(
        (link) =>
          `<a class="text-link" href="${escapeHtml(link.url)}"${link.external ? ' target="_blank" rel="noreferrer"' : ""}>${escapeHtml(link.label)}</a>`
      )
      .join("")}
  </div>`;
}

function rightsSafeLinks(song) {
  return listeningActions(song).map((action) => ({
    label: action.label,
    url: action.url,
    external: action.external,
  }));
}

function sourceTrail(song) {
  const links = [];
  if (song.sourceUrl) {
    links.push({
      label: song.sourceLabel || "Primary source",
      url: song.sourceUrl,
    });
  }
  if (song.watchUrl && song.watchUrl !== song.sourceUrl) {
    links.push({
      label: song.watchLabel || "Official video",
      url: song.watchUrl,
    });
  }
  if (!links.length) return "";

  return `<div class="source-trail" aria-label="Source trail">
    <span>Source trail</span>
    ${links
      .map((link) => `<a href="${escapeHtml(link.url)}" target="_blank" rel="noreferrer">${escapeHtml(link.label)}</a>`)
      .join("")}
  </div>`;
}

function songReferencesSection(song) {
  const references = referencesForSong(song);
  if (!references.length) return "";

  return `<section class="reference-section" aria-labelledby="references-title-${escapeHtml(song.slug)}">
    <div class="reference-heading">
      <p class="kicker">Around the song</p>
      <h2 id="references-title-${escapeHtml(song.slug)}">Where to follow the context</h2>
      <p>Use these links to verify the official label, watch the safe version, or follow how fans and media talk about the song. Social and forum links are discovery leads, not primary sources.</p>
    </div>
    <div class="reference-grid">
      ${references.map((reference) => referenceCard(reference)).join("")}
    </div>
  </section>`;
}

function referencesForSong(song) {
  const references = Array.isArray(song.references) ? [...song.references] : [];
  if (song.sourceUrl) {
    references.push({
      kind: "Primary source",
      label: song.sourceLabel || "Primary source",
      url: song.sourceUrl,
      note: "Use this first when checking the song label, tournament context, or source wording.",
    });
  }
  if (song.watchUrl && song.watchUrl !== song.sourceUrl) {
    references.push({
      kind: "Watch",
      label: song.watchLabel || "Official video",
      url: song.watchUrl,
      note: "A safer viewing route than copied uploads, clips, or rehosted video.",
    });
  }
  if (song.spotifyUrl) {
    references.push({
      kind: "Listen",
      label: "Spotify track",
      url: song.spotifyUrl,
      note: "A licensed listening link for users who want the track without this site hosting audio.",
    });
  }
  return uniqueReferences(references).slice(0, 8);
}

function uniqueReferences(references) {
  const seen = new Set();
  return references.filter((reference) => {
    if (!reference?.url || !reference?.label) return false;
    if (seen.has(reference.url)) return false;
    seen.add(reference.url);
    return true;
  });
}

function referenceCard(reference) {
  const kind = reference.kind || "Reference";
  return `<article class="reference-card ${escapeHtml(referenceKindClass(kind))}">
    <span>${escapeHtml(kind)}</span>
    <h3><a href="${escapeHtml(reference.url)}" target="_blank" rel="${escapeHtml(referenceRel(kind))}">${escapeHtml(reference.label)}</a></h3>
    <p>${escapeHtml(reference.note || "External context link for readers who want to go deeper.")}</p>
  </article>`;
}

function referenceKindClass(kind) {
  return `reference-${kind.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "link"}`;
}

function referenceRel(kind) {
  const lower = kind.toLowerCase();
  const base = ["noreferrer", "noopener"];
  if (lower.includes("fan") || lower.includes("social") || lower.includes("live") || lower.includes("forum")) {
    base.push("nofollow");
  }
  return base.join(" ");
}

function explainerBlock({ title, body, extra = "" }) {
  return `<section class="explainer-block">
    <h2>${escapeHtml(title)}</h2>
    <p>${escapeHtml(body)}</p>
    ${extra}
  </section>`;
}

function whatIsSong(song) {
  const base = `${song.title} is cataloged here under the "${song.status}" label for ${song.tournament}. ${song.summary}`;
  if (song.story) return `${base} ${song.story}`;
  return base;
}

function officialStatusAnswer(song) {
  if (song.type === "fan") {
    return `${song.title} is treated as an unofficial fan anthem, not a FIFA official song. The page keeps it in the library because supporters connect it strongly with ${song.country} and ${song.tournament}.`;
  }
  if (song.type === "official") {
    return `${song.title} is listed under the "${song.status}" label because the cited source places it inside the official ${song.tournament} music program. If FIFA changes the label later, this page should follow the source wording instead of guessing.`;
  }
  if (song.status.toLowerCase().includes("official")) {
    return `${song.title} is covered under the "${song.status}" label for its tournament cycle. The page uses the exact source wording rather than calling every track the main World Cup song.`;
  }
  return `${song.title} is cataloged under the "${song.status}" label, which means it belongs in World Cup music history but should not automatically be described as the main official song.`;
}

function performerAnswer(song) {
  if (song.type === "fan") {
    return `The performer credit is best understood as ${song.artist}. For fan anthems, the important point is usually the supporter community and match context, not only a recording artist.`;
  }
  return `The credited artist line is ${song.artist}. This matters for search because many visitors arrive through the artist names first and only then discover the World Cup connection.`;
}

function languageContextAnswer(song) {
  const countryText =
    song.country === "Global"
      ? "a global tournament music context rather than one national team page"
      : `${song.country} context`;
  return `${song.title} is tracked as ${song.language} and connected to ${countryText}. Language and country labels help separate official soundtrack entries, local host-country angles, and supporter songs that travel beyond one match.`;
}

function usageTimingAnswer(song) {
  if (song.type === "official" && song.year === "2026") {
    return `${song.title} belongs to the 2026 tournament cycle, so the page should be refreshed as FIFA releases more official music details, videos, or platform links.`;
  }
  if (song.type === "fan") {
    return `${song.title} is useful when people search for the song attached to a team, player, or fan moment around ${song.tournament}. Fan-anthems can stay relevant long after the match or tournament that made them famous.`;
  }
  return `${song.title} is tied to the ${song.year} cycle and is kept as evergreen World Cup music history. These pages usually become useful again when a new tournament makes fans revisit older songs.`;
}

function searchIntentAnswer(song) {
  return `${song.whyItMatters} The strongest search angles are ${naturalList(song.searchAngles)}, so this page is written to answer label, artist, year, country, and listening-source questions quickly.`;
}

function contextExtras(song) {
  const hasStory = Boolean(song.story);
  const hasFacts = Array.isArray(song.facts) && song.facts.length > 0;
  const hasPeople = Array.isArray(song.people) && song.people.length > 0;
  if (!hasFacts && !hasPeople) return "";

  return `<div class="context-section compact-context">
    ${
      hasFacts
        ? `<ul class="context-facts">
            ${song.facts.map((fact) => `<li>${escapeHtml(fact)}</li>`).join("")}
          </ul>`
        : ""
    }
    ${
      hasPeople
        ? `<div class="people-links" aria-label="People and sources">
            ${song.people.map((person) => personLink(person)).join("")}
          </div>`
        : ""
    }
  </div>`;
}

function searchAngleList(song) {
  return `<ul class="context-facts search-angle-list">
    ${song.searchAngles.map((angle) => `<li>${escapeHtml(angle)}</li>`).join("")}
  </ul>`;
}

function songFaqSection(song) {
  return `<section class="faq-section song-faq" aria-labelledby="faq-title-${escapeHtml(song.slug)}">
    <h2 id="faq-title-${escapeHtml(song.slug)}">${escapeHtml(song.title)} FAQ</h2>
    ${songFaqs(song).map((item) => faqItem(item)).join("")}
  </section>`;
}

function songFaqSchema(song) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    name: `${song.title} FAQ`,
    url: `${site.url}/songs/${song.slug}/`,
    mainEntity: songFaqs(song).map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
    inLanguage: "en",
  };
}

function songFaqs(song) {
  return [
    {
      question: `Is ${song.title} an official World Cup song?`,
      answer: officialStatusAnswer(song),
    },
    {
      question: `Who performs ${song.title}?`,
      answer: performerAnswer(song),
    },
    {
      question: `What language is ${song.title} in?`,
      answer: `${song.title} is listed as ${song.language}. The page also tracks its ${song.country} connection so users can browse by country, year, and song type.`,
    },
    {
      question: `Where can I listen to ${song.title}?`,
      answer: `Use the Spotify, video, or source links on this page. World Cup Music Atlas links out to official or licensed platforms and does not host audio, lyrics, or copied video.`,
    },
  ];
}

function naturalList(items) {
  if (!items.length) return "artist, year, country, and song type";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
}

function personLink(person) {
  return `<a href="${escapeHtml(person.url)}" target="_blank" rel="noreferrer">
    <span>${escapeHtml(person.role)}</span>
    <strong>${escapeHtml(person.name)}</strong>
  </a>`;
}

function mediaForSong(song) {
  const direct = mediaLibrary.songs?.[song.slug];
  if (direct) return direct;
  for (const name of artistNames(song)) {
    const media = mediaLibrary.artists?.[artistSlug(name)];
    if (media) return media;
  }
  return null;
}

function mediaForArtist(artist) {
  const slug = typeof artist === "string" ? artist : artist.slug;
  return mediaLibrary.artists?.[slug] || null;
}

function mediaFigure(media, className, altFallback) {
  if (!media) return "";
  return `<figure class="${escapeHtml(className)}">
    <a class="media-preview-link" href="${escapeHtml(media.sourceUrl)}" target="_blank" rel="noreferrer" aria-label="View larger image and license source">
      <img src="${escapeHtml(media.url)}" alt="${escapeHtml(media.alt || altFallback)}" loading="lazy" decoding="async" />
    </a>
    <figcaption>${imageCredit(media)}</figcaption>
  </figure>`;
}

function cardMedia(media, altFallback) {
  if (!media) return "";
  return `<div class="card-media">
    <img src="${escapeHtml(media.url)}" alt="${escapeHtml(media.alt || altFallback)}" loading="lazy" decoding="async" />
  </div>`;
}

function imageCredit(media) {
  const creator = media.creator || "Wikimedia Commons contributor";
  return `Image: <a href="${escapeHtml(media.sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(creator)}</a>, <a href="${escapeHtml(media.licenseUrl)}" target="_blank" rel="noreferrer">${escapeHtml(media.license)}</a>`;
}

function artistImagePolicy(artist, media) {
  if (media) {
    return `${artist.name} is shown using a reusable Wikimedia Commons image with visible attribution and license metadata. Social-media avatars, copied profile photos, and unlicensed press images are not used.`;
  }
  return `No artist photo is shown for ${artist.name} yet because a clearly reusable source has not been verified. The page uses a text avatar until a public-domain, Creative Commons, or licensed press-kit image is available.`;
}

function buildArtists(items) {
  const artistMap = new Map();
  for (const song of items) {
    for (const name of artistNames(song)) {
      const slug = artistSlug(name);
      if (!artistMap.has(slug)) {
        artistMap.set(slug, {
          slug,
          name,
          kind: artistKind(name),
        });
      }
    }
  }
  return Array.from(artistMap.values()).sort((left, right) => left.name.localeCompare(right.name));
}

function groupByArtist(items) {
  const map = new Map();
  for (const song of items) {
    for (const name of artistNames(song)) {
      const slug = artistSlug(name);
      if (!map.has(slug)) map.set(slug, []);
      map.get(slug).push(song);
    }
  }
  return map;
}

function artistNames(song) {
  return splitArtistNames(song.artist);
}

function splitArtistNames(value) {
  return String(value)
    .split(/,|\band\b|featuring|feat\.?/i)
    .map((item) => item.trim())
    .filter(Boolean);
}

function artistSlug(name) {
  return String(name)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function artistKind(name) {
  const lower = String(name).toLowerCase();
  if (lower.includes("supporters")) return "Supporter group";
  if (lower.includes("team")) return "Team context";
  return "Artist";
}

function artistInlineLinks(song, prefix) {
  return artistNames(song)
    .map((name) => `<a class="artist-link" href="${prefix}artists/${artistSlug(name)}/">${escapeHtml(name)}</a>`)
    .join('<span class="artist-separator">, </span>');
}

function artistCard(artist, prefix) {
  const artistSongs = byArtist.get(artist.slug) || [];
  const media = mediaForArtist(artist);
  return `<article class="artist-card">
    ${media ? cardMedia(media, `${artist.name} portrait`) : artistAvatar(artist)}
    <div>
      <span>${escapeHtml(artist.kind)}</span>
      <h2>${escapeHtml(artist.name)}</h2>
      <p>${escapeHtml(artistConnectionSummary(artistSongs))}</p>
      <a class="text-link" href="${prefix}artists/${artist.slug}/">Open artist page</a>
    </div>
  </article>`;
}

function artistAvatar(artist) {
  const initials = artist.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  return `<div class="artist-avatar" aria-hidden="true">${escapeHtml(initials || "♪")}</div>`;
}

function artistSummary(artist, artistSongs) {
  const imageNote = mediaForArtist(artist)
    ? "The image is sourced from Wikimedia Commons with attribution."
    : "This profile is text-first until reusable image rights are confirmed.";
  return `${artist.name} appears in the atlas through ${artistConnectionSummary(artistSongs)} ${imageNote}`;
}

function artistWhyHere(artist, artistSongs) {
  const songTitles = naturalList(artistSongs.map((song) => song.title));
  if (artist.kind === "Supporter group") {
    return `${artist.name} is included because supporter-led music can become part of World Cup memory even when it is not an official tournament release. Related page: ${songTitles}.`;
  }
  const subject = artistSongs.length === 1 ? `${songTitles} connects` : `${songTitles} connect`;
  return `${artist.name} is included because ${subject} the artist to World Cup music search, tournament context, or fan discovery.`;
}

function artistConnectionSummary(artistSongs) {
  if (!artistSongs.length) return "no current song entries.";
  const years = Array.from(new Set(artistSongs.map((song) => song.year))).sort((left, right) => Number(right) - Number(left));
  const labels = Array.from(new Set(artistSongs.map((song) => song.status))).join(", ");
  return `${artistSongs.length} ${artistSongs.length === 1 ? "song entry" : "song entries"} across ${naturalList(years)}: ${labels}.`;
}

function artistSongLinks(artistSongs) {
  return `<ul class="context-facts artist-song-list">
    ${artistSongs
      .map(
        (song) =>
          `<li><a class="text-link" href="../../songs/${song.slug}/">${escapeHtml(song.title)}</a> · ${escapeHtml(song.year)} · ${escapeHtml(song.status)}</li>`
      )
      .join("")}
  </ul>`;
}

function artistExternalLinks(artist, artistSongs) {
  const links = new Map();
  for (const song of artistSongs) {
    links.set(song.sourceUrl, song.sourceLabel || "Source");
    if (song.watchUrl) links.set(song.watchUrl, song.watchLabel || "Watch");
    if (song.spotifyUrl) links.set(song.spotifyUrl, "Spotify");
  }
  if (!links.size) return "";
  return `<div class="source-links artist-source-links">
    ${Array.from(links.entries())
      .map(([url, label]) => `<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a>`)
      .join("")}
  </div>`;
}

function artistStatList(artist, artistSongs, artistMedia = mediaForArtist(artist)) {
  const years = Array.from(new Set(artistSongs.map((song) => song.year))).sort((left, right) => Number(right) - Number(left));
  const countries = Array.from(new Set(artistSongs.map((song) => song.country))).sort();
  const stats = [
    ["Type", artist.kind],
    ["Songs", String(artistSongs.length)],
    ["Years", naturalList(years)],
    ["Countries", naturalList(countries)],
    ["Image", artistMedia ? `${artistMedia.license} via Wikimedia Commons` : "Text avatar only"],
  ];
  return `<dl class="stat-list">
    ${stats
      .map(
        ([key, value]) => `<div>
          <dt>${escapeHtml(key)}</dt>
          <dd>${escapeHtml(value)}</dd>
        </div>`
      )
      .join("")}
  </dl>`;
}

function relatedList(title, items, prefix) {
  if (!items.length) return "";
  return `<section class="related-section">
    <h2>${escapeHtml(title)}</h2>
    <div class="cards-grid">
      ${items.map((song) => songCard(song, prefix)).join("")}
    </div>
  </section>`;
}

function collectionGrid(items, prefix) {
  return `<section class="related-section">
    <div class="cards-grid">
      ${items.map((song) => songCard(song, prefix)).join("")}
    </div>
  </section>`;
}

function songCard(song, prefix) {
  const media = mediaForSong(song);
  return `<article class="song-card">
    ${cardMedia(media, `${song.title} visual`)}
    <div class="song-meta">
      <span class="pill ${song.type}">${escapeHtml(song.status)}</span>
      <span class="pill">${escapeHtml(song.year)}</span>
      <span class="pill">${escapeHtml(song.country)}</span>
    </div>
    <h3>${escapeHtml(song.title)}</h3>
    <p class="artist">${artistInlineLinks(song, prefix)}</p>
    <p class="note">${escapeHtml(song.summary)}</p>
    <a href="${prefix}songs/${song.slug}/">Open detail page</a>
  </article>`;
}

function sortedSongs(items) {
  return Array.from(items).sort((left, right) => {
    const typeRank = { official: 0, classic: 1, fan: 2 };
    const typeDelta = (typeRank[left.type] ?? 9) - (typeRank[right.type] ?? 9);
    if (typeDelta !== 0) return typeDelta;
    return left.title.localeCompare(right.title);
  });
}

function adBox() {
  return `<aside class="ad-slot detail-ad" aria-label="More ways to browse">
    <span>Keep exploring</span>
    <strong>Find the next song</strong>
    <p>Jump from this song into the timeline, glossary, or full library to compare years, labels, and fan moments.</p>
    <div class="ad-slot-links">
      <a class="text-link" href="../../timeline/">Timeline</a>
      <a class="text-link" href="../../glossary/">Glossary</a>
      <a class="text-link" href="../../index.html#library">Library</a>
    </div>
  </aside>`;
}

function commentSection({ key, kicker, title, placeholder }) {
  return `<section class="comment-section" data-comment-section data-comment-key="${escapeHtml(key)}">
    <div class="comment-head">
      <div>
        <p class="kicker">${escapeHtml(kicker)}</p>
        <h2>${escapeHtml(title)}</h2>
      </div>
      <span data-comment-count>Loading comments</span>
    </div>
    <form class="comment-form" data-comment-form>
      <div class="comment-fields">
        <label>
          <span>Name</span>
          <input name="name" type="text" maxlength="40" placeholder="Visitor" autocomplete="name">
        </label>
        <label>
          <span>Comment</span>
          <textarea name="comment" maxlength="600" rows="3" placeholder="${escapeHtml(placeholder)}" required></textarea>
        </label>
      </div>
      <div class="comment-actions">
        <p class="comment-status" data-comment-status role="status"></p>
        <button type="submit" data-comment-submit>Post</button>
      </div>
    </form>
    <div class="comment-list" data-comment-list></div>
  </section>`;
}

function writePage(segments, html) {
  const dir = path.join(root, ...segments);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), html);
}

function readJsonIfExists(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function groupBy(items, getKey) {
  const map = new Map();
  for (const item of items) {
    const key = getKey(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeJs(value) {
  return String(value).replaceAll("\\", "\\\\").replaceAll("'", "\\'");
}

function escapeJsonLd(value) {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

function normalizeSiteUrl(url) {
  return String(url).trim().replace(/\/+$/, "");
}

function latestDate(values) {
  return values.filter(Boolean).sort().at(-1) || new Date().toISOString().slice(0, 10);
}

function indentBlock(value, spaces) {
  if (!value) return " ".repeat(spaces) + "<!-- Fill site.config.json to enable Google integrations. -->";
  return value
    .split("\n")
    .map((line) => " ".repeat(spaces) + line)
    .join("\n");
}
