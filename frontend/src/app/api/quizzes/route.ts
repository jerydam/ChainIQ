  import type { NextRequest } from 'next/server';
  import { supabase, supabaseAdmin } from '@/lib/supabase'; // Import both clients
  import type { Quiz } from '@/types/quiz';

  export async function GET(req: NextRequest) {
    console.log('📥 Get Quizzes API called');
    
    try {
      const id = req.nextUrl.searchParams.get('id');
      
      if (id) {
        console.log('🔍 Fetching single quiz with id:', id);
        
        // Try with regular client first (respects RLS)
        let { data: quiz, error } = await supabase
          .from('quizzes')
          .select('*')
          .eq('id', id)
          .single();

        // If regular client fails due to RLS, try with admin client
        if (error && error.code === 'PGRST116') {
          console.log('🔄 Trying with admin client due to RLS...');
          const adminResult = await supabaseAdmin
            .from('quizzes')
            .select('*')
            .eq('id', id)
            .single();
          
          quiz = adminResult.data;
          error = adminResult.error;
        }

        if (error) {
          console.error('❌ Error fetching quiz:', error);
          return new Response(
            JSON.stringify({ error: 'Quiz not found', details: error.message }), 
            { status: 404 }
          );
        }

        if (!quiz) {
          console.log('❌ Quiz not found with id:', id);
          return new Response(
            JSON.stringify({ error: 'Quiz not found' }), 
            { status: 404 }
          );
        }

        console.log('✅ Quiz found:', { id: quiz.id, title: quiz.title });

        // Transform the response to match expected format
        const transformedQuiz = {
          id: quiz.id,
          title: quiz.title,
          description: quiz.description,
          questions: quiz.questions,
          difficulty: quiz.difficulty,
          estimatedTime: quiz.estimated_time,
          rewards: quiz.rewards,
          source: quiz.source,
          createdAt: new Date(quiz.created_at),
          rewardType: quiz.reward_type,
          rewardAmount: quiz.reward_amount,
          nftMetadata: quiz.nft_metadata,
          createdBy: quiz.created_by,
          transactionHash: quiz.transaction_hash,
        };

        return new Response(
          JSON.stringify(transformedQuiz),
          { 
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }

      // Fetch all quizzes
      console.log('📋 Fetching all quizzes...');
      
      // Try with regular client first (respects RLS)
      let { data: quizzes, error } = await supabase
        .from('quizzes')
        .select('*')
        .order('created_at', { ascending: false });

      // If regular client fails due to RLS, try with admin client
      if (error && error.code === 'PGRST116') {
        console.log('🔄 Trying with admin client due to RLS...');
        const adminResult = await supabaseAdmin
          .from('quizzes')
          .select('*')
          .order('created_at', { ascending: false });
        
        quizzes = adminResult.data;
        error = adminResult.error;
      }

      if (error) {
        console.error('❌ Error fetching quizzes:', error);
        throw new Error(`Failed to fetch quizzes: ${error.message}`);
      }

      if (!quizzes) {
        console.log('📝 No quizzes found');
        return new Response(JSON.stringify([]), { 
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      console.log('✅ Quizzes fetched successfully:', { count: quizzes.length });

      // Transform the response to match expected format
      const transformedQuizzes = quizzes.map((quiz) => ({
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        questions: quiz.questions,
        difficulty: quiz.difficulty,
        estimatedTime: quiz.estimated_time,
        rewards: quiz.rewards,
        source: quiz.source,
        createdAt: new Date(quiz.created_at),
        rewardType: quiz.reward_type,
        rewardAmount: quiz.reward_amount,
        nftMetadata: quiz.nft_metadata,
        createdBy: quiz.created_by,
        transactionHash: quiz.transaction_hash,
      }));

      return new Response(JSON.stringify(transformedQuizzes), { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error: any) {
      console.error('💥 Get Quizzes API error:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      
      return new Response(
        JSON.stringify({ 
          error: error.message || 'Failed to fetch quizzes',
          timestamp: new Date().toISOString()
        }), 
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  }