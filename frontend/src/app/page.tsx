"use client";
import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import QuizPlayer from '@/components/QuizPlayer';
import { QuizGenerator } from '@/components/QuizGenerator';
import { ConnectWallet } from '@/components/ConnectWallet';
import { ShareToWarpcast } from '@/components/ShareToWarpcast';
import Link from 'next/link';
import type { Quiz } from '@/types/quiz';
import { useWallet } from '@/components/context/WalletContext';
import { QuizRewardsABI } from '@/lib/QuizAbi';
import { createWalletClient, custom } from 'viem';
import { celo, celoAlfajores } from 'viem/chains';
import { sendTransactionWithDivvi } from '@/lib/divvi';
import toast from 'react-hot-toast';
import Image from 'next/image'; 
import { Contract } from 'ethers';

// Placeholder for NETWORKS configuration
const NETWORKS = {
  celo: {
    chainId: 42220,
    name: 'Celo',
    contractAddress: process.env.NEXT_PUBLIC_QUIZ_CONTRACT_ADDRESS || '',
  },
  lisk: {
    chainId: 44787,
    name: 'Celo Alfajores',
    contractAddress: process.env.NEXT_PUBLIC_QUIZ_CONTRACT_ADDRESS || '',
  },
};

// Placeholder for allowed addresses (to be defined based on your requirements)
const allowedAddresses = [
  "0x961B6b05ad723a7039De5e32586CF19b706870E5",
  "0x08f4f4b874f6b55d768258c026d1f75a2c6e10a0",
  "0xB3121eBb78F3CF34b03dfc285C0e2d9343dCF965",
  "0xf07ea30f4821c60ffa4ce3d2d816b339207e7475",
  "0xa4D30Cfd6b2Fec50D94AAe9F2311c961CC217d29",
  "0xD03Cec8c65a5D9875740552b915F007D76e75497",
  "0x81193c6ba3E69c4c47FFE2e4b3304985D1914d93",
  "0xE7eDF84cEdE0a3B20E02A3b540312716EBe1A744",
  "0x317419Db8EB30cEC60Ebf847581be2F02A688c53",
  "0x739CC47B744c93c827B72bCCc07Fcb91628FFca2",
  "0x0307daA1F0d3Ac9e1b78707d18E79B13BE6b7178",
  "0x2A1ABea47881a380396Aa0D150DC6d01F4C8F9cb",
  "0xF46F1B3Bea9cdd4102105EE9bAefc83db333354B",
  "0xd59B83De618561c8FF4E98fC29a1b96ABcBFB18a",
  "0x49B4593d5fbAA8262d22ECDD43826B55F85E0837",
  "0x3207D4728c32391405C7122E59CCb115A4af31eA",
].map((addr) => addr.toLowerCase())


// Placeholder for getErrorInfo function
const getErrorInfo = (error: any) => ({
  code: error.code || 0,
  message: error.message || 'Unknown error',
});

// Placeholder for appendDivviReferralData
const appendDivviReferralData = (data: string) => {
  // Implement Divvi referral data logic here
  return data;
};

// Placeholder for reportTransactionToDivvi
const reportTransactionToDivvi = async (txHash: string, chainId: number) => {
  // Implement Divvi reporting logic here
  console.log(`Reporting to Divvi: txHash=${txHash}, chainId=${chainId}`);
};

export default function Home() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [showGenerator, setShowGenerator] = useState(false);
  const [participation, setParticipation] = useState<{ [quizId: string]: boolean }>({});
  const [error, setError] = useState<string | null>(null);
  const [checkInStatus, setCheckInStatus] = useState<string>('');
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [isAllowedAddress, setIsAllowedAddress] = useState(false);
  const [currentNetwork, setCurrentNetwork] = useState<'celo' | 'lisk' | null>(null);
  const [userAddress, setUserAddress] = useState<string>('');
  const [isDivviSubmitted, setIsDivviSubmitted] = useState(false);
  const contractAddress: string = process.env.NEXT_PUBLIC_QUIZ_CONTRACT_ADDRESS || '';
  const { username, error: walletError } = useWallet();

  // Check wallet connection and address on mount and when wallet changes
  useEffect(() => {
    const checkWalletConnection = async () => {
      if (!window.ethereum) {
        setCheckInStatus('Please install MetaMask or a compatible Web3 wallet.');
        console.error('window.ethereum not found');
        return;
      }

      try {
        console.log('Checking wallet connection...');
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.listAccounts();
        console.log('Connected accounts:', accounts);
        if (accounts.length > 0) {
          const signer = await provider.getSigner();
          const address = await signer.getAddress();
          const network = await provider.getNetwork();
          const chainId = Number(network.chainId);
          setUserAddress(address);
          setIsWalletConnected(true);
          setIsAllowedAddress(allowedAddresses.includes(address.toLowerCase()));
          setCurrentNetwork(
            chainId === NETWORKS.celo.chainId
              ? 'celo'
              : chainId === NETWORKS.lisk.chainId
              ? 'lisk'
              : null
          );
          console.log('Wallet connected:', {
            address,
            isAllowed: allowedAddresses.includes(address.toLowerCase()),
            chainId,
            network:
              chainId === NETWORKS.celo.chainId
                ? 'Celo'
                : chainId === NETWORKS.lisk.chainId
                ? 'Lisk'
                : 'Unknown',
          });
        } else {
          setIsWalletConnected(false);
          setUserAddress('');
          setIsAllowedAddress(false);
          setCurrentNetwork(null);
          console.log('No accounts connected');
          connectWallet();
        }
      } catch (error) {
        const { message } = getErrorInfo(error);
        console.error('Error checking wallet connection:', message);
        setCheckInStatus('Failed to connect to wallet. Please try again.');
      }
    };

    checkWalletConnection();

    if (window.ethereum) {
      window.ethereum.on('accountsChanged', checkWalletConnection);
      window.ethereum.on('chainChanged', checkWalletConnection);
    }

    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', checkWalletConnection);
        window.ethereum.removeListener('chainChanged', checkWalletConnection);
      }
    };
  }, []);

  // Auto-trigger check-in when wallet is connected, address is allowed, and Divvi submission is successful
  useEffect(() => {
    if (isWalletConnected && isDivviSubmitted && !isCheckingIn && currentNetwork) {
      console.log('Conditions met, triggering auto check-in after Divvi submission...');
      handleCheckIn();
    }
  }, [isWalletConnected, isDivviSubmitted, currentNetwork]);

  const connectWallet = async () => {
    if (!window.ethereum) {
      setCheckInStatus('Please install MetaMask or a compatible Web3 wallet.');
      return;
    }

    try {
      console.log('Requesting wallet connection...');
      setCheckInStatus('Please confirm the wallet connection in the popup.');
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      const network = await provider.getNetwork();
      const chainId = Number(network.chainId);
      setUserAddress(address);
      setIsWalletConnected(true);
      setIsAllowedAddress(allowedAddresses.includes(address.toLowerCase()));
      setCurrentNetwork(
        chainId === NETWORKS.celo.chainId
          ? 'celo'
          : chainId === NETWORKS.lisk.chainId
          ? 'lisk'
          : null
      );
      console.log('Wallet connected:', {
        address,
        isAllowed: allowedAddresses.includes(address.toLowerCase()),
        chainId,
        network:
          chainId === NETWORKS.celo.chainId
            ? 'Celo'
            : chainId === NETWORKS.lisk.chainId
            ? 'Lisk'
            : 'Unknown',
      });
      setCheckInStatus('Wallet connected successfully!');
    } catch (error) {
      const { code, message } = getErrorInfo(error);
      console.error('Wallet connection failed:', { code, message, fullError: error });
      setCheckInStatus(
        code === 4001 ? 'Wallet connection rejected by user.' : 'Failed to connect wallet. Please try again.'
      );
    }
  };

  const fetchQuizzes = async () => {
    try {
      const response = await fetch('/api/quizzes');
      if (!response.ok) {
        throw new Error(`Failed to fetch quizzes: ${response.status}`);
      }
      const data = await response.json();
      setQuizzes(data);
    } catch (err: any) {
      const errorMessage = 'Failed to fetch quizzes: ' + err.message;
      setError(errorMessage);
      toast.error(errorMessage);
    }
  };

  const checkParticipation = async (quizId: string) => {
    if (!userAddress) return false;
    try {
      const quizResponse = await fetch(`/api/quizzes?id=${quizId}`);
      if (!quizResponse.ok) {
        console.warn(`Quiz ${quizId} not found: ${quizResponse.status}`);
        return false;
      }
      const quiz = await quizResponse.json();
      const totalQuestions = quiz.questions?.length || 0;

      const response = await fetch(`/api/quizAttempts?quizId=${quizId}&address=${userAddress}`);
      if (response.ok) {
        const { attempt } = await response.json();
        return attempt && attempt.score === totalQuestions;
      }
      return false;
    } catch (err: any) {
      console.error(`Error checking participation for ${quizId}: ${err.message}`);
      return false;
    }
  };

  useEffect(() => {
    if (userAddress && quizzes.length > 0) {
      const updateParticipation = async () => {
        const newParticipation: { [quizId: string]: boolean } = {};
        for (const quiz of quizzes) {
          newParticipation[quiz.id] = await checkParticipation(quiz.id);
        }
        setParticipation(newParticipation);
      };
      updateParticipation().catch((err) =>
        console.error('Error updating participation:', err.message)
      );
    }
  }, [userAddress, quizzes]);

  const handleQuizGenerated = (quiz: Quiz) => {
    setQuizzes([...quizzes, quiz]);
    setShowGenerator(false);
    toast.success('Quiz created successfully!');
  };

  const handleCheckIn = async () => {
    if (!window.ethereum) {
      setCheckInStatus('Please install MetaMask or a compatible Web3 wallet.');
      return;
    }

    if (!isWalletConnected) {
      setCheckInStatus('Please connect your wallet.');
      await connectWallet();
      return;
    }

    if (!isAllowedAddress) {
      setCheckInStatus('Your wallet address is not authorized to perform this action.');
      return;
    }

    if (!currentNetwork) {
      setCheckInStatus('Please switch to either the Celo or Celo Alfajores network.');
      return;
    }

    if (!contractAddress) {
      setCheckInStatus('Contract address is not configured.');
      console.error('NEXT_PUBLIC_QUIZ_CONTRACT_ADDRESS is missing.');
      return;
    }

    setIsCheckingIn(true);
    setCheckInStatus('');

    try {
      console.log('Starting check-in process...');
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      console.log('Signer:', signer);
      const network = await provider.getNetwork();
      const chainId = Number(network.chainId);
      console.log('Network chainId:', chainId);

      // Ensure the wallet is on the correct network (Celo or Celo Alfajores)
      const expectedChainId = NETWORKS[currentNetwork].chainId;
      if (chainId !== expectedChainId) {
        console.log('Network mismatch, attempting to switch...');
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: `0x${expectedChainId.toString(16)}` }],
          });
        } catch (switchError) {
          const { message } = getErrorInfo(switchError);
          console.error('Network switch failed:', message);
          setCheckInStatus(`Please switch to the ${NETWORKS[currentNetwork].name} network.`);
          setIsCheckingIn(false);
          return;
        }
      }

      const contract = new Contract(NETWORKS[currentNetwork].contractAddress, QuizRewardsABI, signer);
      console.log('Contract instance created:', NETWORKS[currentNetwork].contractAddress);

      const walletClient = createWalletClient({
        chain: currentNetwork === 'lisk' ? celoAlfajores : celo,
        transport: custom(window.ethereum),
      });

      let txHash;
      if (currentNetwork === 'celo' || currentNetwork === 'lisk') {
        console.log(`Submitting transaction with Divvi for ${NETWORKS[currentNetwork].name}`);
        txHash = await sendTransactionWithDivvi(
          contract,
          'checkIn',
          [],
          walletClient,
          provider
        );
        console.log(`${NETWORKS[currentNetwork].name} transaction sent:`, txHash);
      } else {
        const tx = await contract.checkIn();
        txHash = tx.hash;
        console.log('Transaction sent:', txHash);
      }

      // Wait for transaction confirmation
      const receipt = await provider.waitForTransaction(txHash);
      console.log('Transaction confirmed:', receipt.transactionHash);
      const timestamp = new Date().toLocaleString('en-US', { timeZone: 'Africa/Lagos' });
      const balanceWei = await provider.getBalance(userAddress);
      const balanceEther = ethers.formatEther(balanceWei);

      setCheckInStatus(
        `Successfully added to Drop List on ${NETWORKS[currentNetwork].name}. ${timestamp}! Balance: ${Number.parseFloat(balanceEther).toFixed(4)} ${currentNetwork === 'celo' ? 'CELO' : 'LSK'}`
      );
      toast.success('Successfully checked in! 🎉');

      if (currentNetwork === 'celo' || currentNetwork === 'lisk') {
        console.log('Attempting to report transaction to Divvi:', {
          txHash,
          chainId,
          timestamp,
          userAddress,
          balance: `${balanceEther} ${currentNetwork === 'celo' ? 'CELO' : 'LSK'}`,
        });
        try {
          await reportTransactionToDivvi(txHash, chainId);
          console.log('Divvi reporting successful');
          setIsDivviSubmitted(true);
        } catch (divviError) {
          const { message } = getErrorInfo(divviError);
          console.error('Divvi reporting failed, but check-in completed:', message);
          setCheckInStatus(
            `Checked in on ${NETWORKS[currentNetwork].name} at ${timestamp} with balance ${Number.parseFloat(balanceEther).toFixed(4)} ${currentNetwork === 'celo' ? 'CELO' : 'LSK'}, but failed to report to Divvi. Please contact support.`
          );
          console.log('Continuing with auto-trigger despite Divvi error');
        }
      } else {
        setIsDivviSubmitted(true);
      }

      setTimeout(() => setIsDivviSubmitted(false), 1000);
    } catch (error) {
      const { code, message } = getErrorInfo(error);
      console.error('Check-in failed:', { code, message, fullError: error });

      let statusMessage = 'Check-in failed: Please try again.';
      if (code === 'INSUFFICIENT_FUNDS') {
        statusMessage = 'Check-in failed: Insufficient funds in your wallet.';
      } else if (code === 4001) {
        statusMessage = 'Check-in failed: Transaction rejected by user.';
      } else if (message.includes('already checked in')) {
        statusMessage = 'You have already checked in today.';
      } else if (message) {
        statusMessage = `Check-in failed: ${message}`;
      }

      setCheckInStatus(statusMessage);
      toast.error(statusMessage);

      if (code !== 4001) {
        console.log('Non-user-rejection error, keeping auto-trigger active');
      } else {
        setIsDivviSubmitted(false);
      }
    } finally {
      setIsCheckingIn(false);
    }
  };

  useEffect(() => {
    fetchQuizzes();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black text-white py-6 sm:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <header className="text-center mb-8 sm:mb-12">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
            <Image
              src="/logo.png"
              alt="ChainIQ Logo"
              width={200}
              height={100}
              className="inline-block mb-2 sm:mb-0" />
          </h1>
          <p className="mt-2 sm:mt-3 text-base sm:text-lg text-gray-300 px-4">
            Learn, earn, and mint NFTs on the Celo blockchain
            {username && (
              <span className="block sm:inline">
                <span className="hidden sm:inline">, </span>
                <span className="sm:hidden">Welcome, </span>
                {username}!
              </span>
            )}
          </p>
          <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center">
            <Link href="/rewards">
              <button className="w-full sm:w-auto px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-yellow-400 to-orange-400 hover:from-yellow-500 hover:to-orange-500 text-black font-semibold rounded-full transition-all duration-300 text-sm sm:text-base">
                🏆 View Rewards
              </button>
            </Link>
            <button
              onClick={handleCheckIn}
              disabled={isCheckingIn || !isWalletConnected || !isAllowedAddress}
              className="w-full sm:w-auto px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-green-400 to-teal-400 hover:from-green-500 hover:to-teal-500 text-black font-semibold rounded-full transition-all duration-300 disabled:bg-gray-600 text-sm sm:text-base"
            >
              {isCheckingIn ? 'Checking In...' : '✅ Check In'}
            </button>
          </div>
        </header>

        {(error || walletError || checkInStatus) && (
          <div className="mb-6 sm:mb-8 p-4 bg-red-500/20 text-red-300 rounded-lg text-center text-sm sm:text-base">
            {error || walletError || checkInStatus}
          </div>
        )}

        <div className="flex flex-col sm:flex-row justify-center mb-6 sm:mb-8 gap-3 sm:gap-4">
          <ConnectWallet
            className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-lg transition-all px-4 py-2 text-sm sm:text-base"
          />
          {isWalletConnected && selectedQuiz && (
            <div className="w-full sm:w-auto">
              <ShareToWarpcast
                quizTitle={selectedQuiz.title}
                quizId={selectedQuiz.id}
                userAddress={userAddress || ''}
                username={username || ''}
              />
            </div>
          )}
        </div>

        <main>
          {selectedQuiz ? (
            <QuizPlayer quiz={selectedQuiz} />
          ) : showGenerator ? (
            <QuizGenerator onQuizGenerated={handleQuizGenerated} />
          ) : (
            <div>
              <div className="flex justify-center mb-8 sm:mb-10">
                <button
                  onClick={() => setShowGenerator(true)}
                  className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold text-base sm:text-lg rounded-xl shadow-lg hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300"
                >
                  🚀 Create New Quiz
                </button>
              </div>

              <section>
                <h2 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6 text-center bg-clip-text text-transparent bg-gradient-to-r from-blue-300 to-purple-400">
                  Available Quizzes
                </h2>
                {quizzes.length === 0 ? (
                  <p className="text-center text-gray-400 text-base sm:text-lg animate-pulse px-4">
                    No quizzes available. Create one to get started!
                  </p>
                ) : (
                  <div className="space-y-4 sm:space-y-6 lg:space-y-8">
                    {quizzes.map((quiz) => (
                      <div
                        key={quiz.id}
                        className="bg-gray-800/40 backdrop-blur-sm rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-blue-500/20 hover:border-blue-500/50 shadow-xl hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300"
                      >
                        <h3 className="text-lg sm:text-xl font-semibold text-blue-200 mb-2">{quiz.title}</h3>
                        <p className="text-gray-300 text-sm sm:text-base mb-4 line-clamp-2">{quiz.description}</p>
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
                          <span className="text-xs sm:text-sm text-gray-400">
                            {participation[quiz.id] ? 'Completed (Perfect Score)' : 'Not Completed'}
                          </span>
                          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
                            <Link href={`/quiz/${quiz.id}`} className="w-full sm:w-auto">
                              <button className="w-full sm:w-auto px-3 sm:px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg shadow-md hover:shadow-lg transition-all duration-200 text-sm sm:text-base">
                                {participation[quiz.id] ? 'View Results' : 'Take Quiz'}
                              </button>
                            </Link>
                            <div className="w-full sm:w-auto">
                              <ShareToWarpcast
                                quizTitle={quiz.title}
                                quizId={quiz.id}
                                userAddress={userAddress || ''}
                                username={username || ''}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
