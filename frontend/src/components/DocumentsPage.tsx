"use client";

import { useState, useEffect, useCallback } from "react";
import { api, uploadFile } from "@/lib/api";

interface DocumentsPageProps {
  token: string;
}

interface Document {
  id: string;
  filename: string;
  file_type: string;
  file_size: number;
  status: string;
  created_at: string;
}

export default function DocumentsPage({ token }: DocumentsPageProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [dragActive, setDragActive] = useState(false);

  const fetchDocs = useCallback(() => {
    api<Document[]>("/api/documents/", { token }).then(setDocuments).catch(console.error);
  }, [token]);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    setUploadStatus("Uploading...");
    try {
      await uploadFile("/api/documents/upload", file, token);
      setUploadStatus("Processing with AI...");
      // Poll for completion
      const interval = setInterval(() => {
        fetchDocs();
      }, 3000);
      setTimeout(() => {
        clearInterval(interval);
        setUploading(false);
        setUploadStatus("");
        fetchDocs();
      }, 30000);
    } catch (err) {
      setUploadStatus(err instanceof Error ? err.message : "Upload failed");
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "analyzed":
        return <span className="badge-safe">Analyzed</span>;
      case "processing":
        return <span className="badge-warning">Processing</span>;
      case "error":
        return <span className="badge-critical">Error</span>;
      default:
        return <span className="badge-info">{status}</span>;
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Documents</h1>

      {/* Upload zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-12 text-center mb-8 transition-colors ${
          dragActive
            ? "border-safe bg-green-900/10"
            : "border-navy-600 hover:border-navy-500"
        }`}
      >
        {uploading ? (
          <div>
            <div className="animate-spin w-8 h-8 border-2 border-safe border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-safe font-medium">{uploadStatus}</p>
          </div>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 text-gray-500 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-gray-300 font-medium">Drop files here or click to upload</p>
            <p className="text-gray-500 text-sm mt-1">PDF, DOCX, or images. AI will analyze against EHS framework.</p>
            <input
              type="file"
              accept=".pdf,.docx,.doc,.png,.jpg,.jpeg,.tiff"
              onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload" className="btn-primary inline-block mt-4 cursor-pointer">
              Choose File
            </label>
          </>
        )}
      </div>

      {/* Document list */}
      <div className="space-y-3">
        {documents.map((doc) => (
          <div key={doc.id} className="card-hover flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-navy-700 rounded-lg flex items-center justify-center text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <p className="font-medium">{doc.filename}</p>
                <p className="text-sm text-gray-500">
                  {(doc.file_size / 1024).toFixed(0)} KB
                  {" / "}
                  {new Date(doc.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
            {statusBadge(doc.status)}
          </div>
        ))}
        {documents.length === 0 && (
          <p className="text-gray-500 text-center py-8">No documents uploaded yet. Drop a file above to get started.</p>
        )}
      </div>
    </div>
  );
}
