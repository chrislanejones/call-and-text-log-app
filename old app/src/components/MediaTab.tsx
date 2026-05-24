import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function MediaTab() {
  const media = useQuery(api.media.getAllMedia);

  if (!media) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      {media.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No media files found
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {media.map((item) => (
            <div key={item._id} className="bg-white rounded-lg shadow overflow-hidden">
              {item.contentType.startsWith("image/") ? (
                <img
                  src={item.url || ""}
                  alt={item.fileName}
                  className="w-full h-32 object-cover"
                />
              ) : (
                <div className="w-full h-32 bg-gray-200 flex items-center justify-center">
                  <span className="text-4xl">📄</span>
                </div>
              )}
              <div className="p-2">
                <p className="text-xs text-gray-600 truncate">{item.fileName}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
