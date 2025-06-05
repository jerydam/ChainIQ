import type { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';

interface QuizAttempt {
  id: string;
  quiz_id: string;
  user_address: string;
  score: number;
  completed_at: string;
  answers: any;
  reward_issued: boolean;
}

export async function POST(req: NextRequest) {
  try {
    const { quizId, address, score, answers, timeTaken } = await req.json();
    
    // Validate required fields
    if (!quizId || !address || typeof score !== 'number' || !answers) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: quizId, address, score, and answers are required' }), 
        { status: 400 }
      );
    }

    // Generate unique ID for the attempt
    const attemptId = uuidv4();
    const completedAt = new Date().toISOString();

    // Insert new quiz attempt
    const { data, error } = await supabase.from('quiz_attempts').insert({
      id: attemptId,
      quiz_id: quizId,
      user_address: address,
      score,
      completed_at: completedAt,
      answers,
      reward_issued: false
    }).select().single();

    if (error) {
      console.error('Error inserting quiz attempt:', error);
      
      // Handle duplicate attempts if you want to allow updates
      if (error.code === '23505') {
        // If you want to allow multiple attempts, you might want to just insert with a new ID
        // Or if you want to prevent duplicates, return an appropriate error
        return new Response(
          JSON.stringify({ error: 'Quiz attempt already exists for this user and quiz' }), 
          { status: 409 }
        );
      }
      
      throw new Error(`Failed to save quiz attempt: ${error.message}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        attemptId: data.id,
        message: 'Quiz attempt saved successfully' 
      }), 
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error processing quiz attempt:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to process quiz attempt' }), 
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const address = req.nextUrl.searchParams.get('address');
    const quizId = req.nextUrl.searchParams.get('quizId');
    
    if (!address) {
      return new Response(
        JSON.stringify({ error: 'Missing address parameter' }), 
        { status: 400 }
      );
    }

    let query = supabase
      .from('quiz_attempts')
      .select('id, quiz_id, user_address, score, completed_at, answers, reward_issued')
      .eq('user_address', address)
      .order('completed_at', { ascending: false });

    // If quizId is provided, filter by it
    if (quizId) {
      query = query.eq('quiz_id', quizId);
    }

    const { data: attempts, error } = await query;

    if (error) {
      console.error('Error fetching quiz attempts:', error);
      throw new Error(`Failed to fetch attempts: ${error.message}`);
    }

    return new Response(
      JSON.stringify({ 
        attempts: attempts || [],
        count: attempts?.length || 0
      }), 
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error fetching quiz attempts:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to fetch quiz attempts' }), 
      { status: 500 }
    );
  }
}

// Optional: Add PUT endpoint for updating reward status
export async function PUT(req: NextRequest) {
  try {
    const { attemptId, rewardIssued } = await req.json();
    
    if (!attemptId || typeof rewardIssued !== 'boolean') {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: attemptId and rewardIssued' }), 
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('quiz_attempts')
      .update({ reward_issued: rewardIssued })
      .eq('id', attemptId)
      .select()
      .single();

    if (error) {
      console.error('Error updating quiz attempt:', error);
      throw new Error(`Failed to update attempt: ${error.message}`);
    }

    if (!data) {
      return new Response(
        JSON.stringify({ error: 'Quiz attempt not found' }), 
        { status: 404 }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        attempt: data,
        message: 'Quiz attempt updated successfully' 
      }), 
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error updating quiz attempt:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to update quiz attempt' }), 
      { status: 500 }
    );
  }
}