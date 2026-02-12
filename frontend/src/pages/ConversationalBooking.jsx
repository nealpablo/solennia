import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ChatInterface from '../components/ChatInterface';
import BookingPreview from '../components/BookingPreview';
import toast from '../utils/toast';

const API = import.meta.env.VITE_API_BASE ||
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD
    ? "https://solennia.up.railway.app/api"
    : "/api");

export default function ConversationalBooking() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Hi! I'm your AI Assistant. 👋\n\nJust tell me about your event like you're chatting with a friend, and I'll help you find and book the perfect vendors.\n\nWhat event are you planning?"
    }
  ]);

  const [extractedData, setExtractedData] = useState({
    event_type: null,
    date: null,
    time: null,
    location: null,
    budget: null,
    guests: null,
    preferences: []
  });

  const [bookingStage, setBookingStage] = useState('discovery');
  const [isProcessing, setIsProcessing] = useState(false);
  const [bookingCreated, setBookingCreated] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('solennia_token');
    if (!token) {
      toast.error('Please log in to create a booking');
      navigate('/');
    }
  }, [navigate]);

  const handleSendMessage = async (userMessage) => {
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsProcessing(true);

    try {
      const token = localStorage.getItem('solennia_token');

      const response = await fetch(`${API}/ai/conversational-booking`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: userMessage,
          currentData: extractedData,
          stage: bookingStage,
          history: messages.slice(1)
        })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to process message');
      }

      if (data.extractedInfo && Object.keys(data.extractedInfo).length > 0) {
        setExtractedData(prev => ({ ...prev, ...data.extractedInfo }));
      }

      if (data.stage) {
        setBookingStage(data.stage);
      }

      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: data.aiResponse,
          vendors: data.suggestedVendors || []
        }
      ]);

      if (data.bookingCreated && data.bookingId) {
        setBookingCreated(true);
        toast.success('Booking created successfully! 🎉');
        setTimeout(() => navigate('/my-bookings'), 3000);
      }

    } catch (error) {
      console.error('Error:', error);
      toast.error(error.message || 'Failed to send message');
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: "I'm sorry, I encountered an error. Please try again." }
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f0e8] py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🤖 AI Assistant
          </h1>
          <p className="text-gray-600">
            Event Booking Assistant
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-[600px]">
            <ChatInterface
              messages={messages}
              onSendMessage={handleSendMessage}
              isProcessing={isProcessing}
            />
          </div>

          <div className="lg:col-span-1">
            <BookingPreview data={extractedData} stage={bookingStage} />
          </div>
        </div>

        {bookingCreated && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-8 max-w-md text-center">
              <div className="text-6xl mb-4">🎉</div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Booking Created!
              </h2>
              <p className="text-gray-600 mb-6">
                Your booking request has been sent. Redirecting...
              </p>
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}