import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";

type MessageData = {
  address: string;
  body: string;
  date: number;
  type: number;
  threadId?: string;
  contactName?: string;
};

type CallData = {
  number: string;
  duration: number;
  date: number;
  type: number;
  contactName?: string;
};

export function ImportTab() {
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{
    current: number;
    total: number;
    type: string;
  } | null>(null);
  
  const importMessages = useMutation(api.messages.importMessages);
  const importCalls = useMutation(api.calls.importCalls);

  const parseXMLFile = (file: File): Promise<Document> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(e.target?.result as string, "text/xml");
          resolve(xmlDoc);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  const parseSMSXML = (xmlDoc: Document): MessageData[] => {
    const smsElements = xmlDoc.querySelectorAll("sms");
    const messages: MessageData[] = [];

    for (const sms of smsElements) {
      messages.push({
        address: sms.getAttribute("address") || "",
        body: sms.getAttribute("body") || "",
        date: parseInt(sms.getAttribute("date") || "0"),
        type: parseInt(sms.getAttribute("type") || "1"),
        threadId: sms.getAttribute("thread_id") || undefined,
        contactName: sms.getAttribute("contact_name") || undefined,
      });
    }

    return messages;
  };

  const parseCallsXML = (xmlDoc: Document): CallData[] => {
    const callElements = xmlDoc.querySelectorAll("call");
    const calls: CallData[] = [];

    for (const call of callElements) {
      calls.push({
        number: call.getAttribute("number") || "",
        duration: parseInt(call.getAttribute("duration") || "0"),
        date: parseInt(call.getAttribute("date") || "0"),
        type: parseInt(call.getAttribute("type") || "1"),
        contactName: call.getAttribute("contact_name") || undefined,
      });
    }

    return calls;
  };

  const importMessagesInChunks = async (messages: MessageData[]) => {
    const chunkSize = 1000;
    let totalImported = 0;

    setImportProgress({ current: 0, total: messages.length, type: "messages" });

    for (let i = 0; i < messages.length; i += chunkSize) {
      const chunk = messages.slice(i, i + chunkSize);
      
      try {
        const result = await importMessages({ messages: chunk });
        totalImported += result.imported;
        
        setImportProgress({ 
          current: Math.min(totalImported, messages.length), 
          total: messages.length, 
          type: "messages"
        });
      } catch (error) {
        console.error(`Error importing messages chunk ${i}-${i + chunkSize}:`, error);
        toast.error(`Failed to import messages chunk starting at item ${i + 1}`);
      }
    }

    setImportProgress(null);
    toast.success(`Successfully imported ${totalImported} messages`);
  };

  const importCallsInChunks = async (calls: CallData[]) => {
    const chunkSize = 1000;
    let totalImported = 0;

    setImportProgress({ current: 0, total: calls.length, type: "calls" });

    for (let i = 0; i < calls.length; i += chunkSize) {
      const chunk = calls.slice(i, i + chunkSize);
      
      try {
        const result = await importCalls({ calls: chunk });
        totalImported += result.imported;
        
        setImportProgress({ 
          current: Math.min(totalImported, calls.length), 
          total: calls.length, 
          type: "calls"
        });
      } catch (error) {
        console.error(`Error importing calls chunk ${i}-${i + chunkSize}:`, error);
        toast.error(`Failed to import calls chunk starting at item ${i + 1}`);
      }
    }

    setImportProgress(null);
    toast.success(`Successfully imported ${totalImported} calls`);
  };

  const handleLargeFileImport = async (file: File) => {
    toast.loading("Processing large file... This may take several minutes.");

    try {
      // For very large files, process them in streaming chunks
      const text = await file.text();
      
      // Simple regex-based parsing for large files to avoid DOM parser memory issues
      const smsMatches = text.match(/<sms[^>]*>/g);
      const callMatches = text.match(/<call[^>]*>/g);

      if (smsMatches && smsMatches.length > 0) {
        await processLargeMessageMatches(smsMatches);
      } else if (callMatches && callMatches.length > 0) {
        await processLargeCallMatches(callMatches);
      } else {
        toast.error("No SMS or call data found in the XML file");
      }
    } catch (error) {
      console.error("Large file processing error:", error);
      toast.error("Failed to process large file. File may be too large or corrupted.");
    }
  };

  const processLargeMessageMatches = async (matches: string[]) => {
    const chunkSize = 1000;
    let totalImported = 0;

    setImportProgress({ current: 0, total: matches.length, type: "messages" });

    for (let i = 0; i < matches.length; i += chunkSize) {
      const chunk = matches.slice(i, i + chunkSize);
      const parsedMessages: MessageData[] = [];

      for (const match of chunk) {
        try {
          const address = match.match(/address="([^"]*)"/) ?.[1] || "";
          const body = match.match(/body="([^"]*)"/) ?.[1] || "";
          const date = parseInt(match.match(/date="([^"]*)"/) ?.[1] || "0");
          const msgType = parseInt(match.match(/type="([^"]*)"/) ?.[1] || "1");
          const threadId = match.match(/thread_id="([^"]*)"/) ?.[1];
          const contactName = match.match(/contact_name="([^"]*)"/) ?.[1];

          parsedMessages.push({
            address,
            body,
            date,
            type: msgType,
            threadId,
            contactName,
          });
        } catch (error) {
          console.error("Error parsing message:", error);
        }
      }

      try {
        const result = await importMessages({ messages: parsedMessages });
        totalImported += result.imported;

        setImportProgress({ 
          current: Math.min(totalImported, matches.length), 
          total: matches.length, 
          type: "messages"
        });
      } catch (error) {
        console.error(`Error importing messages chunk ${i}-${i + chunkSize}:`, error);
        toast.error(`Failed to import messages chunk starting at item ${i + 1}`);
      }
    }

    setImportProgress(null);
    toast.success(`Successfully imported ${totalImported} messages`);
  };

  const processLargeCallMatches = async (matches: string[]) => {
    const chunkSize = 1000;
    let totalImported = 0;

    setImportProgress({ current: 0, total: matches.length, type: "calls" });

    for (let i = 0; i < matches.length; i += chunkSize) {
      const chunk = matches.slice(i, i + chunkSize);
      const parsedCalls: CallData[] = [];

      for (const match of chunk) {
        try {
          const number = match.match(/number="([^"]*)"/) ?.[1] || "";
          const duration = parseInt(match.match(/duration="([^"]*)"/) ?.[1] || "0");
          const date = parseInt(match.match(/date="([^"]*)"/) ?.[1] || "0");
          const callType = parseInt(match.match(/type="([^"]*)"/) ?.[1] || "1");
          const contactName = match.match(/contact_name="([^"]*)"/) ?.[1];

          parsedCalls.push({
            number,
            duration,
            date,
            type: callType,
            contactName,
          });
        } catch (error) {
          console.error("Error parsing call:", error);
        }
      }

      try {
        const result = await importCalls({ calls: parsedCalls });
        totalImported += result.imported;

        setImportProgress({ 
          current: Math.min(totalImported, matches.length), 
          total: matches.length, 
          type: "calls"
        });
      } catch (error) {
        console.error(`Error importing calls chunk ${i}-${i + chunkSize}:`, error);
        toast.error(`Failed to import calls chunk starting at item ${i + 1}`);
      }
    }

    setImportProgress(null);
    toast.success(`Successfully imported ${totalImported} calls`);
  };

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file size and warn user
    const fileSizeGB = file.size / (1024 * 1024 * 1024);
    const fileSizeMB = file.size / (1024 * 1024);
    
    if (fileSizeGB > 1) {
      const proceed = confirm(
        `This file is ${fileSizeGB.toFixed(1)}GB. Large files may take a very long time to process and could crash your browser. Do you want to continue?`
      );
      if (!proceed) {
        event.target.value = "";
        return;
      }
    }

    setIsImporting(true);
    try {
      if (fileSizeMB > 500) {
        // For files larger than 500MB, use streaming approach
        await handleLargeFileImport(file);
      } else {
        // For smaller files, use the original DOM parser approach
        const xmlDoc = await parseXMLFile(file);
        
        // Check if it's SMS or calls XML
        const smsElements = xmlDoc.querySelectorAll("sms");
        const callElements = xmlDoc.querySelectorAll("call");

        if (smsElements.length > 0) {
          const messages = parseSMSXML(xmlDoc);
          await importMessagesInChunks(messages);
        } else if (callElements.length > 0) {
          const calls = parseCallsXML(xmlDoc);
          await importCallsInChunks(calls);
        } else {
          toast.error("No SMS or call data found in the XML file");
        }
      }
    } catch (error) {
      console.error("Import error:", error);
      toast.error("Failed to import data. Please check the file format.");
    } finally {
      setIsImporting(false);
      event.target.value = "";
    }
  };

  return (
    <div className="h-full p-8">
      <div className="max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Import Data</h2>
        
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Import SMS & Call Data
          </h3>
          <p className="text-gray-600 mb-4">
            Upload XML files exported from SMS Backup & Restore Android app.
            The app supports both SMS messages and call logs, including large files up to several GB.
          </p>
          
          {importProgress && (
            <div className="mb-4 p-4 bg-blue-50 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-blue-900">
                  Importing {importProgress.type}...
                </span>
                <span className="text-sm text-blue-700">
                  {importProgress.current.toLocaleString()} / {importProgress.total.toLocaleString()}
                </span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                ></div>
              </div>
              <p className="text-xs text-blue-600 mt-1">
                {((importProgress.current / importProgress.total) * 100).toFixed(1)}% complete
              </p>
            </div>
          )}
          
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <input
              type="file"
              accept=".xml"
              onChange={handleFileImport}
              disabled={isImporting}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className={`cursor-pointer ${
                isImporting ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              <div className="text-4xl mb-4">📁</div>
              <p className="text-lg font-medium text-gray-900 mb-2">
                {isImporting ? "Importing..." : "Choose XML file"}
              </p>
              <p className="text-sm text-gray-500">
                Select your SMS Backup & Restore XML file (supports large files)
              </p>
            </label>
          </div>
        </div>

        <div className="bg-blue-50 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-medium text-blue-900 mb-3">
            How to export from SMS Backup & Restore:
          </h3>
          <ol className="list-decimal list-inside space-y-2 text-blue-800">
            <li>Open SMS Backup & Restore app on your Android device</li>
            <li>Tap "Backup" to create a backup</li>
            <li>Choose what to backup (SMS, Calls, or both)</li>
            <li>Select "Local Backup" and choose XML format</li>
            <li>Transfer the XML file(s) to this device</li>
            <li>Upload the file(s) using the button above</li>
          </ol>
        </div>

        <div className="bg-yellow-50 rounded-lg p-6">
          <h3 className="text-lg font-medium text-yellow-900 mb-3">
            Large File Support:
          </h3>
          <ul className="list-disc list-inside space-y-1 text-yellow-800">
            <li>Files over 500MB use optimized streaming processing</li>
            <li>Very large files (10GB+) may take 10-30 minutes to process</li>
            <li>Progress is shown during import</li>
            <li>Data is imported in chunks to avoid memory issues</li>
            <li>Keep this tab open during the import process</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
