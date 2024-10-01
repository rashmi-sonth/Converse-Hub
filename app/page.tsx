'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import {
  AiOutlinePlus,
  AiOutlineEdit,
  AiOutlineEye,
  AiOutlineEyeInvisible,
  AiOutlineClockCircle,
  AiOutlineInfoCircle,
  AiOutlineDelete,
} from 'react-icons/ai';
import { FaComments, FaChevronRight } from 'react-icons/fa';

interface Message {
  id: number;
  content: string;
  parent_id: number | null;
  version: number;
  created_at: string;
}

export default function HomePage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [branchesVisible, setBranchesVisible] = useState<Record<number, boolean>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null); // For displaying error messages

  useEffect(() => {
    fetchMessages();

    const channel = supabase
      .channel('messages')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        (payload) => {
          console.log('Change received!', payload);
          fetchMessages();
        }
      )
      .subscribe();

    // Cleanup the subscription on component unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .order('parent_id', { ascending: false })
        .order('version', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      setMessages(data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
      setErrorMessage('Error fetching messages. Please try again.');
    }
  };

  const sendMessage = async (parentMessage: Message | null = null) => {
    if (input.trim() === '') return;

    try {
      const { error } = await supabase.from('messages').insert({
        content: input,
        parent_id: parentMessage ? parentMessage.parent_id : null,
        version: parentMessage ? parentMessage.version + 1 : 1,
      });

      if (error) throw error;

      setInput('');
      setSelectedMessage(null);
    } catch (error) {
      console.error('Error sending message:', error);
      setErrorMessage('Error sending message. Please try again.');
    }
  };

  const deleteMessage = async (messageId: number) => {
    if (!window.confirm('Are you sure you want to delete this message and all its replies?')) {
      return;
    }

    try {
      // Delete the message and its child messages recursively
      await deleteMessageRecursive(messageId);
      // Refresh messages after deletion
      fetchMessages();
    } catch (error) {
      console.error('Error deleting message:', error);
      setErrorMessage('Error deleting message. Please try again.');
    }
  };

  const deleteMessageRecursive = async (messageId: number) => {
    // Fetch all child messages
    const { data: childMessages, error } = await supabase
      .from('messages')
      .select('id')
      .eq('parent_id', messageId);

    if (error) throw error;

    // Recursively delete child messages
    if (childMessages && childMessages.length > 0) {
      for (const child of childMessages) {
        await deleteMessageRecursive(child.id);
      }
    }

    // Delete the message itself
    const { error: deleteError } = await supabase.from('messages').delete().eq('id', messageId);

    if (deleteError) throw deleteError;
  };

  const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      sendMessage(selectedMessage);
    }
  };

  const toggleBranchesVisibility = (messageId: number) => {
    setBranchesVisible((prev) => ({
      ...prev,
      [messageId]: !prev[messageId],
    }));
  };

  const handleCancel = () => {
    setInput('');
    setSelectedMessage(null);
  };

  const getRelativeDate = (createdAt: string) => {
    const createdDate = new Date(createdAt);
    const currentDate = new Date();
    const timeDifference = currentDate.getTime() - createdDate.getTime();
    const dayDifference = Math.round(timeDifference / (1000 * 60 * 60 * 24));

    if (dayDifference === 0) {
      return 'Today';
    } else if (dayDifference === 1) {
      return 'Yesterday';
    } else if (dayDifference === -1) {
      return 'Tomorrow';
    } else if (dayDifference > 0) {
      return `${dayDifference} days ago`;
    } else {
      return `In ${Math.abs(dayDifference)} days`;
    }
  };

  const renderMessages = (parentId: number | null = null, level: number = 0) => {
    // Get the messages that belong to the given parent
    const filteredMessages = messages.filter((message) => message.parent_id === parentId);

    // Sort messages by version in descending order
    const sortedMessages = filteredMessages.sort((a, b) => b.version - a.version);

    return sortedMessages.map((message) => (
      <div key={message.id} className={`ml-${level * 4} relative`}>
        <div
          className={`flex items-start p-4 rounded-lg ${
            level % 2 === 0 ? 'bg-blue-50' : 'bg-gray-50'
          } border-l-4 border-blue-500 shadow-md w-full`}
        >
          <div className="flex-shrink-0">
            <FaChevronRight className="text-blue-400 mt-1" />
          </div>
          <div className="ml-2 flex-grow">
            <p className="text-base font-medium">{message.content}</p>
            <span className="text-xs text-gray-500 flex items-center space-x-2 mt-1">
              <span className="flex items-center">
                <AiOutlineInfoCircle className="mr-1 text-blue-400" />
                <span>v{message.version}</span>
              </span>
              <span className="flex items-center">
                <AiOutlineClockCircle className="mr-1 text-gray-400" />
                <span title={new Date(message.created_at).toLocaleString()}>
                  {getRelativeDate(message.created_at)}
                </span>
              </span>
            </span>
            <div className="mt-2 flex flex-wrap space-x-4">
              <button
                className="flex items-center text-blue-500 hover:text-blue-700"
                onClick={() => {
                  setSelectedMessage(message);
                  setInput(message.content);
                  setTimeout(() => {
                    document.getElementById('message-input')?.focus();
                  }, 100);
                }}
              >
                <AiOutlineEdit className="mr-1" /> Edit
              </button>
              <button
                className="flex items-center text-green-500 hover:text-green-700"
                onClick={() => toggleBranchesVisibility(message.id)}
              >
                {branchesVisible[message.id] ? (
                  <>
                    <AiOutlineEyeInvisible className="mr-1" /> Hide Branches
                  </>
                ) : (
                  <>
                    <AiOutlineEye className="mr-1" /> View Branches
                  </>
                )}
              </button>
              <button
                className="flex items-center text-purple-500 hover:text-purple-700"
                onClick={() => {
                  setSelectedMessage(message);
                  setInput('');
                  setTimeout(() => {
                    document.getElementById('message-input')?.focus();
                  }, 100);
                }}
              >
                <AiOutlinePlus className="mr-1" /> Branch Reply
              </button>
              <button
                className="flex items-center text-red-500 hover:text-red-700"
                onClick={() => deleteMessage(message.id)}
              >
                <AiOutlineDelete className="mr-1" /> Delete
              </button>
            </div>
          </div>
        </div>
        {/* Render child messages if branches are visible */}
        {branchesVisible[message.id] && (
          <div className="ml-6 mt-2 border-l-2 border-blue-300 pl-4">
            {renderMessages(message.id, level + 1)}
          </div>
        )}
      </div>
    ));
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header with Logo */}
      <div className="flex items-center justify-center py-4 bg-blue-600 text-white shadow-md">
        <FaComments className="text-3xl mr-3" />
        <h1 className="text-3xl font-bold text-center">Converse Hub</h1>
      </div>
      {/* Error Message */}
      {errorMessage && (
        <div className="bg-red-100 text-red-700 p-4 text-center">{errorMessage}</div>
      )}
      {/* Chat Messages */}
      <div className="flex-grow overflow-y-auto p-6 bg-gray-50">
        <div className="max-w-full mx-auto">{renderMessages()}</div>
      </div>
      {/* Input Section */}
      <div className="sticky bottom-0 bg-white p-4 shadow-md flex items-center w-full border-t">
        <input
          id="message-input"
          type="text"
          className="flex-grow p-3 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress} // Handle enter key press
          placeholder={selectedMessage ? 'Update message...' : 'Type a new message...'}
        />
        <button
          onClick={() => sendMessage(selectedMessage)}
          className="bg-blue-600 text-white px-6 py-3 ml-3 rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {selectedMessage ? 'Update Message' : 'Send'}
        </button>
        {selectedMessage && (
          <button
            onClick={handleCancel}
            className="bg-gray-500 text-white px-6 py-3 ml-3 rounded hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
