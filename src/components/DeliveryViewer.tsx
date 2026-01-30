'use client';

import { useState } from 'react';
import { 
  FileText, Clipboard, Check, Link2, Globe, Folder, MessageSquare,
  FileCode, Image as ImageIcon, Music, Video, Archive, Database,
  File, Palette, BookOpen
} from 'lucide-react';

interface Delivery {
  id: string;
  order_id: string;
  agent_id: string;
  delivery_type: 'text' | 'file' | 'url' | 'mixed';
  content_text?: string;
  content_url?: string;
  file_urls?: string;
  notes?: string;
  delivered_at: string;
}

interface DeliveryViewerProps {
  delivery: Delivery;
}

export function DeliveryViewer({ delivery }: DeliveryViewerProps) {
  const [copied, setCopied] = useState(false);

  const copyText = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Parse file URLs if present
  const fileUrls: string[] = delivery.file_urls ? JSON.parse(delivery.file_urls) : [];

  return (
    <div className="space-y-6">
      {/* Text Content */}
      {delivery.content_text && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm font-medium flex items-center gap-1.5">
              <FileText className="w-4 h-4" /> Text Content
            </span>
            <button
              onClick={() => copyText(delivery.content_text!)}
              className="text-orange-400 hover:text-orange-300 text-sm flex items-center gap-1 transition"
            >
              {copied ? <><Check className="w-4 h-4" /> Copied!</> : <><Clipboard className="w-4 h-4" /> Copy</>}
            </button>
          </div>
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-700">
            <pre className="text-white whitespace-pre-wrap font-mono text-sm overflow-x-auto">
              {delivery.content_text}
            </pre>
          </div>
        </div>
      )}

      {/* URL Content */}
      {delivery.content_url && (
        <div>
          <span className="text-gray-400 text-sm font-medium flex items-center gap-1.5 mb-2">
            <Link2 className="w-4 h-4" /> URL
          </span>
          <a
            href={delivery.content_url}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-gray-900 rounded-xl p-4 border border-gray-700 flex items-center gap-3 hover:border-orange-500/50 transition group"
          >
            <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
              <Globe className="w-5 h-5 text-orange-400" />
            </div>
            <div className="flex-grow min-w-0">
              <div className="text-white font-medium truncate group-hover:text-orange-400 transition">
                {delivery.content_url}
              </div>
              <div className="text-gray-400 text-sm">Click to open in new tab</div>
            </div>
            <span className="text-gray-400 group-hover:text-orange-400 transition">→</span>
          </a>
        </div>
      )}

      {/* File Downloads */}
      {fileUrls.length > 0 && (
        <div>
          <span className="text-gray-400 text-sm font-medium flex items-center gap-1.5 mb-2">
            <Folder className="w-4 h-4" /> Files ({fileUrls.length})
          </span>
          <div className="space-y-2">
            {fileUrls.map((url, index) => {
              const filename = url.split('/').pop() || `File ${index + 1}`;
              const extension = filename.split('.').pop()?.toLowerCase() || '';
              const icon = getFileIcon(extension);

              return (
                <a
                  key={index}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="bg-gray-900 rounded-xl p-4 border border-gray-700 flex items-center gap-3 hover:border-orange-500/50 transition group"
                >
                  <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center text-blue-400">
                    {icon}
                  </div>
                  <div className="flex-grow min-w-0">
                    <div className="text-white font-medium truncate group-hover:text-orange-400 transition">
                      {filename}
                    </div>
                    <div className="text-gray-400 text-sm uppercase">{extension} file</div>
                  </div>
                  <button className="bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 px-4 py-2 rounded-lg text-sm font-medium transition">
                    Download
                  </button>
                </a>
              );
            })}
          </div>
        </div>
      )}

      {/* Agent Notes */}
      {delivery.notes && (
        <div>
          <span className="text-gray-400 text-sm font-medium flex items-center gap-1.5 mb-2">
            <MessageSquare className="w-4 h-4" /> Agent Notes
          </span>
          <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-700">
            <p className="text-gray-300 whitespace-pre-wrap">{delivery.notes}</p>
          </div>
        </div>
      )}

      {/* Delivery Metadata */}
      <div className="pt-4 border-t border-gray-700 flex items-center justify-between text-sm text-gray-400">
        <div>
          Delivery Type: <span className="text-white capitalize">{delivery.delivery_type}</span>
        </div>
        <div>
          Delivery ID: <span className="text-white font-mono">{delivery.id.slice(0, 8)}</span>
        </div>
      </div>
    </div>
  );
}

function getFileIcon(extension: string): React.ReactNode {
  const iconClass = "w-5 h-5";
  
  // Documents
  if (['pdf', 'doc', 'docx'].includes(extension)) {
    return <BookOpen className={iconClass} />;
  }
  if (['txt', 'md'].includes(extension)) {
    return <FileText className={iconClass} />;
  }
  
  // Images
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(extension)) {
    return <ImageIcon className={iconClass} />;
  }
  
  // Code
  if (['js', 'ts', 'jsx', 'tsx', 'html', 'css', 'json'].includes(extension)) {
    return <FileCode className={iconClass} />;
  }
  
  // Archives
  if (['zip', 'rar', 'tar', 'gz'].includes(extension)) {
    return <Archive className={iconClass} />;
  }
  
  // Audio
  if (['mp3', 'wav'].includes(extension)) {
    return <Music className={iconClass} />;
  }
  
  // Video
  if (['mp4', 'mov'].includes(extension)) {
    return <Video className={iconClass} />;
  }
  
  // Data
  if (['csv', 'xlsx', 'xls'].includes(extension)) {
    return <Database className={iconClass} />;
  }
  
  // Default
  return <File className={iconClass} />;
}
