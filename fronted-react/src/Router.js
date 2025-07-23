// src/Router.js
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './pages/login'; // pages 폴더를 src 아래로 옮겼다고 가정
import Register from './pages/register';
import ChatRooms from './pages/chat-rooms';
import NewChatRoom from './pages/chat-rooms/new';
import ChatPage from './pages/chat';
import Profile from './pages/profile';
import Navbar from './components/Navbar';

// withAuth, withoutAuth HOC를 가져옵니다.
import { withAuth } from './middleware/withAuth';
import { withoutAuth } from './middleware/withAuth';

// 각 페이지 컴포넌트에 HOC를 적용합니다.
const AuthChatRooms = withAuth(ChatRooms);
const AuthNewChatRoom = withAuth(NewChatRoom);
const AuthChatPage = withAuth(ChatPage);
const AuthProfile = withAuth(Profile);

const WithoutAuthLogin = withoutAuth(Login);
const WithoutAuthRegister = withoutAuth(Register);


function AppRouter() {
  // 로그인 여부에 따라 Navbar를 보여주기 위한 로직
  // 실제로는 useLocation 훅을 사용해야 하지만, 여기서는 간단히 표현
  const showNavbar = !['/', '/register'].includes(window.location.pathname);

  return (
    <BrowserRouter>
      {showNavbar && <Navbar />}
      <Routes>
        <Route path="/" element={<WithoutAuthLogin />} />
        <Route path="/login" element={<WithoutAuthLogin />} />
        <Route path="/register" element={<WithoutAuthRegister />} />
        <Route path="/chat-rooms" element={<AuthChatRooms />} />
        <Route path="/chat-rooms/new" element={<AuthNewChatRoom />} />
        <Route path="/chat" element={<AuthChatPage />} />
        <Route path="/profile" element={<AuthProfile />} />
        {/* 404 Not Found 페이지도 설정할 수 있습니다. */}
        {/* <Route path="*" element={<NotFound />} /> */}
      </Routes>
    </BrowserRouter>
  );
}

export default AppRouter;