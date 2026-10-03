const esbuild=require('esbuild');
const path=require('path');
const fs=require('node:fs');
const {execFileSync}=require('node:child_process');
module.exports=async function buildHarness(root,output){
fs.mkdirSync(output,{recursive:true});
fs.copyFileSync(path.join(__dirname,'index.html'),path.join(output,'index.html'));
const mocks={
 '@/contexts/LanguageContext':`import { t } from '${root}/src/lib/i18n.ts'; export function useLanguage(){return { t:(key,params)=>t(key,'en',params),locale:'en',dir:'ltr' }}`,
 '@/hooks/use-profile':`const profile={totalXp:0,coins:0};export function useProfile(){return {profile,loading:false,refresh:async()=>{}}}`,
 '@/hooks/use-toast':`export const useToast=()=>({toast:()=>{}})`,
 '@/app/(app)/quiz/actions':`export async function submitAnswer(){return {correct:true,correctIndex:0,explanation:'Synthetic explanatory text. '+ 'LongSyntheticExplanation'.repeat(20),citation:'https://synthetic.invalid/'+ 'synthetic-reference'.repeat(20),xpEarned:10,newAchievements:[],newChests:[]}};export async function recordHuntRun(){};export async function getLevelOutcome(){return null};export async function spendLifeline(){throw Error('Fixture lifelines disabled')};export async function fiftyFifty(){return []}`,
 'next/navigation':`export const useRouter=()=>({push:()=>{}})`,
 'next/link':`import React from 'react';export default function Link({href,children,...props}){return React.createElement('a',{href,...props},children)}`,
 'next/dynamic':`export default ()=>()=>null`,
 '../AskTheImamDialog':`export const AskTheImamDialog=()=>null`,
};
await esbuild.build({entryPoints:[path.join(__dirname,'fixture.tsx')],bundle:true,outfile:path.join(output,'app.js'),platform:'browser',format:'iife',jsx:'automatic',nodePaths:[root+'/node_modules'],define:{'process.env.NODE_ENV':'"development"'},plugins:[{name:'safe-fixtures',setup(b){b.onResolve({filter:/.*/},args=>{if(args.path in mocks)return {path:args.path,namespace:'mock'};if(args.path.startsWith('@/'))return {path:path.join(root,'src',args.path.slice(2))+(!path.extname(args.path)?(['.tsx','.ts'].find(ext=>require('fs').existsSync(path.join(root,'src',args.path.slice(2))+ext))||''):'')};});b.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:mocks[args.path],loader:'tsx',resolveDir:root}));}}]});
execFileSync(process.execPath,[path.join(root,'node_modules/tailwindcss/lib/cli.js'),'-i',path.join(root,'src/app/globals.css'),'-o',path.join(output,'app.css'),'--config',path.join(root,'tailwind.config.ts')],{cwd:root,stdio:'inherit'});
};
