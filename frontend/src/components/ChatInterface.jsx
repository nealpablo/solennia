import { useState, useRef, useEffect } from 'react';

export default function ChatInterface({ messages, onSendMessage, isProcessing }) {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (inputValue.trim() && !isProcessing) {
      onSendMessage(inputValue.trim());
      setInputValue('');
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-lg">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[75%] rounded-lg p-3 ${msg.role === 'user'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-800'
                }`}
            >
              {msg.role === 'assistant' && (
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">🤖</span>
                  <span className="font-semibold text-sm">Solennia AI</span>
                </div>
              )}

              <p className="whitespace-pre-wrap">{msg.content}</p>

              {msg.vendors && msg.vendors.length > 0 && (
                <div className="mt-3 space-y-2">
                  {msg.vendors.map((vendor) => (
                    <VendorCard key={vendor.ID} vendor={vendor} />
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {isProcessing && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
                <span className="text-sm text-gray-600">AI is thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="border-t p-4">
        <div className="flex gap-2 items-end">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder="Tell me about your event..."
            disabled={isProcessing}
            rows={1}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 resize-none min-h-[44px] max-h-32"
            style={{ height: 'auto', minHeight: '44px' }}
            onInput={(e) => {
              e.target.style.height = 'auto';
              e.target.style.height = e.target.scrollHeight + 'px';
            }}
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isProcessing}
            className="px-6 py-2 h-[44px] bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}

function VendorCard({ vendor }) {
  const formatPrice = (price) => {
    // If pricing is null/empty
    if (!price) return 'Contact for pricing';

    // Try to parse number
    const num = parseFloat(price);

    // If it's a valid number and looks like just a number (no text mixed in)
    if (!isNaN(num) && String(num) === String(price).trim()) {
      return '₱' + num.toLocaleString();
    }

    // If it's a string (e.g. "Package A - 15k"), check if we should display it
    // For now, return as is but maybe truncate if too long?
    return price.toString();
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h4 className="font-semibold text-gray-900">{vendor.BusinessName}</h4>
          <span className="text-xs text-gray-500">{vendor.Category}</span>
        </div>
        <span className="text-sm font-bold text-blue-600 ml-2 text-right">
          {formatPrice(vendor.Pricing)}
        </span>
      </div>

      <p className="text-sm text-gray-600 mb-2 line-clamp-2">
        {vendor.Description}
      </p>

      <div className="flex items-center gap-2 text-xs text-gray-500">
        {vendor.AverageRating && (
          <span>⭐ {vendor.AverageRating}</span>
        )}
        {vendor.TotalReviews > 0 && (
          <span>({vendor.TotalReviews} reviews)</span>
        )}
      </div>
    </div>
  );
}