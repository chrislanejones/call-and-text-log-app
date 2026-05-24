use anyhow::{Context, Result};
use base64::Engine;
use clap::Parser;
use indicatif::{ProgressBar, ProgressStyle};
use quick_xml::events::{BytesStart, Event};
use quick_xml::Reader;
use rusqlite::{params, Connection};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs;
use std::io::{BufReader, Write};
use std::path::{Path, PathBuf};

#[derive(Parser)]
#[command(name = "sms-parser")]
#[command(about = "Parse SMS Backup & Restore XML into SQLite + image folder")]
struct Cli {
    /// SMS/MMS XML file (sms-*.xml)
    #[arg(long)]
    sms: Option<PathBuf>,
    /// Calls XML file (calls-*.xml)
    #[arg(long)]
    calls: Option<PathBuf>,
    /// Output SQLite database (relative to current working directory)
    #[arg(long, default_value = "data/data.db")]
    db: PathBuf,
    /// Output directory for extracted MMS images (relative to current working directory)
    #[arg(long, default_value = "data/mms")]
    images: PathBuf,
}

fn main() -> Result<()> {
    let cli = Cli::parse();

    if cli.sms.is_none() && cli.calls.is_none() {
        anyhow::bail!("Provide at least one of --sms or --calls");
    }

    if let Some(parent) = cli.db.parent() {
        fs::create_dir_all(parent).ok();
    }
    fs::create_dir_all(&cli.images).context("create images dir")?;

    let mut conn = Connection::open(&cli.db)?;
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.pragma_update(None, "synchronous", "NORMAL")?;
    conn.pragma_update(None, "temp_store", "MEMORY")?;
    init_schema(&conn)?;

    if let Some(path) = &cli.calls {
        println!("Parsing calls: {}", path.display());
        parse_calls(&mut conn, path)?;
    }

    if let Some(path) = &cli.sms {
        println!("Parsing SMS/MMS: {}", path.display());
        parse_sms(&mut conn, path, &cli.images)?;
    }

    println!("Optimizing FTS index...");
    conn.execute("INSERT INTO messages_fts(messages_fts) VALUES('optimize')", [])?;
    conn.execute("ANALYZE", [])?;

    let n_msg: i64 = conn.query_row("SELECT COUNT(*) FROM messages", [], |r| r.get(0))?;
    let n_call: i64 = conn.query_row("SELECT COUNT(*) FROM calls", [], |r| r.get(0))?;
    let n_att: i64 = conn.query_row("SELECT COUNT(*) FROM attachments", [], |r| r.get(0))?;
    println!("\nDone. {} messages, {} calls, {} attachments.", n_msg, n_call, n_att);
    Ok(())
}

fn init_schema(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        r#"
CREATE TABLE IF NOT EXISTS calls (
    rowid INTEGER PRIMARY KEY,
    uid TEXT UNIQUE NOT NULL,
    number TEXT,
    number_normalized TEXT,
    contact_name TEXT,
    duration INTEGER,
    date INTEGER NOT NULL,
    type INTEGER,
    readable_date TEXT
);
CREATE INDEX IF NOT EXISTS idx_calls_date ON calls(date);
CREATE INDEX IF NOT EXISTS idx_calls_number ON calls(number_normalized);
CREATE INDEX IF NOT EXISTS idx_calls_contact ON calls(contact_name);

CREATE TABLE IF NOT EXISTS messages (
    rowid INTEGER PRIMARY KEY,
    uid TEXT UNIQUE NOT NULL,
    kind TEXT NOT NULL,
    address TEXT,
    address_normalized TEXT,
    conversation_key TEXT,
    contact_name TEXT,
    body TEXT,
    date INTEGER NOT NULL,
    type INTEGER,
    readable_date TEXT,
    has_images INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_messages_date ON messages(date);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_key);
CREATE INDEX IF NOT EXISTS idx_messages_addr ON messages(address_normalized);
CREATE INDEX IF NOT EXISTS idx_messages_contact ON messages(contact_name);
CREATE INDEX IF NOT EXISTS idx_messages_images ON messages(has_images);

CREATE TABLE IF NOT EXISTS attachments (
    rowid INTEGER PRIMARY KEY,
    message_rowid INTEGER NOT NULL REFERENCES messages(rowid) ON DELETE CASCADE,
    hash TEXT NOT NULL,
    content_type TEXT,
    filename TEXT,
    size INTEGER
);
CREATE INDEX IF NOT EXISTS idx_attachments_message ON attachments(message_rowid);
CREATE INDEX IF NOT EXISTS idx_attachments_hash ON attachments(hash);

CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
    body, contact_name, address,
    content='messages', content_rowid='rowid',
    tokenize='porter unicode61'
);

CREATE TRIGGER IF NOT EXISTS messages_ai AFTER INSERT ON messages BEGIN
    INSERT INTO messages_fts(rowid, body, contact_name, address)
    VALUES (new.rowid, new.body, new.contact_name, new.address);
END;
CREATE TRIGGER IF NOT EXISTS messages_ad AFTER DELETE ON messages BEGIN
    INSERT INTO messages_fts(messages_fts, rowid, body, contact_name, address)
    VALUES('delete', old.rowid, old.body, old.contact_name, old.address);
END;
        "#,
    )?;
    Ok(())
}

fn attrs(e: &BytesStart) -> Result<HashMap<String, String>> {
    let mut out = HashMap::new();
    for a in e.attributes() {
        let a = a?;
        let key = String::from_utf8_lossy(a.key.as_ref()).to_string();
        let val = a.unescape_value()?.to_string();
        out.insert(key, val);
    }
    Ok(out)
}

fn normalize_number(s: &str) -> String {
    let digits: String = s.chars().filter(|c| c.is_ascii_digit()).collect();
    if digits.len() == 11 && digits.starts_with('1') {
        digits[1..].to_string()
    } else {
        digits
    }
}

fn conversation_key(address: &str) -> String {
    let mut parts: Vec<String> = address.split('~').map(normalize_number).collect();
    parts.sort();
    parts.join("|")
}

fn hash_str(parts: &[&str]) -> String {
    let mut h = Sha256::new();
    for p in parts {
        h.update(p.as_bytes());
        h.update(b"\x1f");
    }
    format!("{:x}", h.finalize())
}

fn ext_for_ct(ct: &str) -> &'static str {
    match ct.to_ascii_lowercase().as_str() {
        "image/jpeg" | "image/jpg" => "jpg",
        "image/png" => "png",
        "image/gif" => "gif",
        "image/webp" => "webp",
        "image/heic" => "heic",
        "image/bmp" => "bmp",
        "video/mp4" => "mp4",
        "video/3gpp" => "3gp",
        "video/quicktime" => "mov",
        "audio/amr" => "amr",
        "audio/mpeg" | "audio/mp3" => "mp3",
        "audio/aac" | "audio/mp4" => "m4a",
        "audio/ogg" => "ogg",
        _ => "bin",
    }
}

fn make_progress(path: &Path) -> Result<ProgressBar> {
    let size = fs::metadata(path)?.len();
    let pb = ProgressBar::new(size);
    pb.set_style(
        ProgressStyle::with_template(
            "{spinner} {bytes}/{total_bytes} {bar:40} {percent}% {bytes_per_sec} ETA {eta}",
        )
        .unwrap(),
    );
    Ok(pb)
}

fn parse_calls(conn: &mut Connection, path: &Path) -> Result<()> {
    let file = fs::File::open(path)?;
    let pb = make_progress(path)?;
    let mut reader = Reader::from_reader(BufReader::with_capacity(1 << 20, file));
    reader.config_mut().trim_text(false);

    let tx = conn.transaction()?;
    {
        let mut ins = tx.prepare(
            "INSERT OR IGNORE INTO calls
            (uid, number, number_normalized, contact_name, duration, date, type, readable_date)
            VALUES (?,?,?,?,?,?,?,?)",
        )?;

        let mut buf = Vec::new();
        let mut count = 0u64;
        loop {
            let pos = reader.buffer_position();
            pb.set_position(pos);
            match reader.read_event_into(&mut buf)? {
                Event::Empty(e) | Event::Start(e) if e.name().as_ref() == b"call" => {
                    let a = attrs(&e)?;
                    let number = a.get("number").cloned().unwrap_or_default();
                    let date_str = a.get("date").cloned().unwrap_or_default();
                    let date: i64 = date_str.parse().unwrap_or(0);
                    let duration = a.get("duration").and_then(|v| v.parse::<i64>().ok());
                    let type_v = a.get("type").and_then(|v| v.parse::<i64>().ok());
                    let contact = a.get("contact_name").cloned().unwrap_or_default();
                    let readable = a.get("readable_date").cloned().unwrap_or_default();
                    let uid = hash_str(&[
                        &date_str,
                        &number,
                        &a.get("duration").cloned().unwrap_or_default(),
                        &a.get("type").cloned().unwrap_or_default(),
                    ]);
                    let normalized = normalize_number(&number);
                    ins.execute(params![
                        uid,
                        number,
                        normalized,
                        contact,
                        duration,
                        date,
                        type_v,
                        readable
                    ])?;
                    count += 1;
                }
                Event::Eof => break,
                _ => {}
            }
            buf.clear();
        }
        pb.finish_and_clear();
        println!("  parsed {} call rows", count);
    }
    tx.commit()?;
    Ok(())
}

struct MmsBuilder {
    address: String,
    contact_name: String,
    date: i64,
    date_str: String,
    type_v: Option<i64>,
    msg_box: Option<i64>,
    readable_date: String,
    mms_id: String,
    body_parts: Vec<String>,
    images: Vec<ImagePart>,
}

struct ImagePart {
    content_type: String,
    filename: Option<String>,
    data_b64: String,
}

fn parse_sms(conn: &mut Connection, path: &Path, images_dir: &Path) -> Result<()> {
    let file = fs::File::open(path)?;
    let pb = make_progress(path)?;
    let mut reader = Reader::from_reader(BufReader::with_capacity(1 << 20, file));
    // text outside tags isn't important here; don't trim to be safe with whitespace in <part text="...">
    reader.config_mut().trim_text(false);

    let tx = conn.transaction()?;
    {
        let mut ins_msg = tx.prepare(
            "INSERT OR IGNORE INTO messages
            (uid, kind, address, address_normalized, conversation_key, contact_name, body, date, type, readable_date, has_images)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        )?;
        let mut ins_att = tx.prepare(
            "INSERT INTO attachments (message_rowid, hash, content_type, filename, size) VALUES (?,?,?,?,?)",
        )?;
        let mut select_rowid = tx.prepare("SELECT rowid FROM messages WHERE uid = ?")?;

        let mut buf = Vec::new();
        let mut sms_count = 0u64;
        let mut mms_count = 0u64;

        loop {
            let pos = reader.buffer_position();
            pb.set_position(pos);
            let evt = reader.read_event_into(&mut buf)?;
            match evt {
                Event::Empty(e) if e.name().as_ref() == b"sms" => {
                    let a = attrs(&e)?;
                    let address = a.get("address").cloned().unwrap_or_default();
                    let body = a.get("body").cloned().unwrap_or_default();
                    let date_str = a.get("date").cloned().unwrap_or_default();
                    let date: i64 = date_str.parse().unwrap_or(0);
                    let type_v = a.get("type").and_then(|v| v.parse::<i64>().ok());
                    let contact = a.get("contact_name").cloned().unwrap_or_default();
                    let readable = a.get("readable_date").cloned().unwrap_or_default();
                    let normalized = normalize_number(&address);
                    let conv_key = conversation_key(&address);
                    let uid = hash_str(&[
                        "sms",
                        &date_str,
                        &address,
                        &body,
                        &a.get("type").cloned().unwrap_or_default(),
                    ]);
                    ins_msg.execute(params![
                        uid,
                        "sms",
                        address,
                        normalized,
                        conv_key,
                        contact,
                        body,
                        date,
                        type_v,
                        readable,
                        0
                    ])?;
                    sms_count += 1;
                }
                Event::Start(e) if e.name().as_ref() == b"mms" => {
                    let a = attrs(&e)?;
                    let mut mms = MmsBuilder {
                        address: a.get("address").cloned().unwrap_or_default(),
                        contact_name: a.get("contact_name").cloned().unwrap_or_default(),
                        date: a.get("date").and_then(|v| v.parse::<i64>().ok()).unwrap_or(0),
                        date_str: a.get("date").cloned().unwrap_or_default(),
                        type_v: None,
                        msg_box: a.get("msg_box").and_then(|v| v.parse::<i64>().ok()),
                        readable_date: a.get("readable_date").cloned().unwrap_or_default(),
                        mms_id: a.get("_id").cloned().unwrap_or_default(),
                        body_parts: Vec::new(),
                        images: Vec::new(),
                    };
                    // msg_box: 1=inbox, 2=sent → map to sms 'type' convention
                    mms.type_v = mms.msg_box;

                    // read inner events until </mms>
                    let mut inner = Vec::new();
                    loop {
                        match reader.read_event_into(&mut inner)? {
                            Event::Empty(pe) | Event::Start(pe) if pe.name().as_ref() == b"part" => {
                                let pa = attrs(&pe)?;
                                let ct = pa.get("ct").cloned().unwrap_or_default();
                                if ct.starts_with("text/") {
                                    if let Some(t) = pa.get("text") {
                                        if t != "null" && !t.is_empty() {
                                            mms.body_parts.push(t.clone());
                                        }
                                    }
                                } else if ct.starts_with("image/")
                                    || ct.starts_with("video/")
                                    || ct.starts_with("audio/")
                                {
                                    if let Some(data) = pa.get("data") {
                                        if data != "null" && !data.is_empty() {
                                            mms.images.push(ImagePart {
                                                content_type: ct.clone(),
                                                filename: pa.get("cl").cloned().filter(|s| s != "null"),
                                                data_b64: data.clone(),
                                            });
                                        }
                                    }
                                }
                            }
                            Event::End(end) if end.name().as_ref() == b"mms" => break,
                            Event::Eof => break,
                            _ => {}
                        }
                        inner.clear();
                    }

                    let body = mms.body_parts.join("\n");
                    let normalized = normalize_number(&mms.address);
                    let conv_key = conversation_key(&mms.address);
                    let has_images = if mms.images.is_empty() { 0 } else { 1 };
                    let uid = if !mms.mms_id.is_empty() {
                        hash_str(&["mms", &mms.mms_id, &mms.date_str, &mms.address])
                    } else {
                        hash_str(&["mms", &mms.date_str, &mms.address, &body])
                    };

                    ins_msg.execute(params![
                        uid,
                        "mms",
                        mms.address,
                        normalized,
                        conv_key,
                        mms.contact_name,
                        body,
                        mms.date,
                        mms.type_v,
                        mms.readable_date,
                        has_images
                    ])?;

                    // get rowid (might be NULL if INSERT OR IGNORE matched existing)
                    let rowid: Option<i64> = select_rowid
                        .query_row(params![uid], |r| r.get::<_, i64>(0))
                        .ok();

                    if let Some(rid) = rowid {
                        for img in &mms.images {
                            let bytes = match base64::engine::general_purpose::STANDARD
                                .decode(img.data_b64.as_bytes())
                            {
                                Ok(b) => b,
                                Err(_) => continue,
                            };
                            let mut hasher = Sha256::new();
                            hasher.update(&bytes);
                            let hash = format!("{:x}", hasher.finalize());
                            let ext = ext_for_ct(&img.content_type);
                            let shard = &hash[0..2];
                            let dir = images_dir.join(shard);
                            fs::create_dir_all(&dir).ok();
                            let path = dir.join(format!("{}.{}", hash, ext));
                            if !path.exists() {
                                if let Ok(mut f) = fs::File::create(&path) {
                                    let _ = f.write_all(&bytes);
                                }
                            }
                            ins_att.execute(params![
                                rid,
                                hash,
                                img.content_type,
                                img.filename,
                                bytes.len() as i64
                            ])?;
                        }
                    }
                    mms_count += 1;
                }
                Event::Eof => break,
                _ => {}
            }
            buf.clear();
        }
        pb.finish_and_clear();
        println!("  parsed {} SMS, {} MMS rows", sms_count, mms_count);
    }
    tx.commit()?;
    Ok(())
}
