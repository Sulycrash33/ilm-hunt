import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { QuizRunner } from '@/components/game/QuizRunner';
import { LiveQuiz } from '@/components/multiplayer/LiveQuiz';
import { QuizResults } from '@/components/multiplayer/QuizResults';
import { PrayerTimesCard } from '@/components/game/PrayerTimesCard';
import { GameExperienceProvider } from '@/contexts/GameExperienceContext';
const token = 'SyntheticLongReference'.repeat(12);
const questions = [1,2].map(id=>({id:String(id),text:`Synthetic fixture question ${id}: which choice matches this harmless layout label? ${token}`,options:[`Synthetic option ${token}`,'A second synthetic option with enough ordinary words to wrap onto several lines on a small screen.','Fixture option C','Fixture option D'],categoryName:'Synthetic layout fixtures',difficulty:'Beginner' as const,tier:1,points:10,timeLimit:30}));
const players=[1,2,3].map(id=>({id:String(id),userName:`SyntheticPlayer${id}`.repeat(4),score:90-id*10,correctAnswers:2,totalAnswers:2,streak:0}));
function Battle(){const [startedAt]=useState(()=>new Date().toISOString());const [step,setStep]=useState(0);const [correct,setCorrect]=useState<boolean|null>(null);return <LiveQuiz question={{id:'battle'+step,questionText:questions[step].text,choices:questions[step].options,timeLimit:600,startedAt}} questionNumber={1} totalQuestions={2} timeLimit={600} players={players} currentUserId='1' onAnswer={async()=>{setCorrect(true);return true}} onNextQuestion={()=>{setCorrect(null);setStep(1)}} isHost showResults={false} lastAnswerCorrect={correct} />}
function Results(){const [resultPlayers,setResultPlayers]=useState(players);useEffect(()=>{(window as any).fixtureUpdateWinner=()=>setResultPlayers(current=>current.map(player=>({...player,score:player.id==='2'?1000:player.score})));return()=>{delete(window as any).fixtureUpdateWinner}},[]);return <QuizResults players={resultPlayers} currentUserId='1' onPlayAgain={()=>{}} onLeave={()=>{}} isHost/>}
function App(){const scenario=new URLSearchParams(location.search).get('scenario');return <GameExperienceProvider><main className='mx-auto max-w-3xl px-4 py-6'>{scenario==='prayer'?<PrayerTimesCard/>:scenario==='battle'?<Battle/>:scenario==='results'?<Results/>:<QuizRunner categoryName='Synthetic layout fixtures' categoryDescription='Private synthetic browser fixtures; no published question content.' categoryIcon='📚' categoryId={null} questions={questions} lifelinePrices={[]} fixedLadder allowReplay={false} modeRules={{lives:null,runSeconds:null,perQuestionTimer:false,endless:false}}/>}</main></GameExperienceProvider>}
createRoot(document.getElementById('root')!).render(<App/>);
